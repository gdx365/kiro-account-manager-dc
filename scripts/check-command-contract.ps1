Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FrontendInvokeCommands {
  $files = rg --files src | Where-Object { $_ -match '\.(ts|tsx|js|jsx)$' }
  $names = New-Object System.Collections.Generic.HashSet[string]
  foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $matches = [regex]::Matches($content, "invoke(?:<[^>]+>)?\('([a-zA-Z0-9_]+)'")
    foreach ($m in $matches) {
      [void]$names.Add($m.Groups[1].Value)
    }
    $stringMatches = [regex]::Matches($content, "runKiroCommand\('([a-zA-Z0-9_]+)'")
    foreach ($m in $stringMatches) {
      [void]$names.Add($m.Groups[1].Value)
    }
  }
  return $names
}

function Get-RustCommandFunctions {
  $files = rg -l "#\[tauri::command\]" src-tauri/src/commands
  $names = New-Object System.Collections.Generic.HashSet[string]
  foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $matches = [regex]::Matches($content, "#\[tauri::command\][\s\r\n]*pub\s+(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(")
    foreach ($m in $matches) {
      [void]$names.Add($m.Groups[1].Value)
    }
  }
  return $names
}

function Get-RegisteredCommands {
  $main = Get-Content src-tauri/src/main.rs -Raw
  $m = [regex]::Match($main, "generate_handler!\[(?<body>[\s\S]*?)\]")
  $names = New-Object System.Collections.Generic.HashSet[string]
  if ($m.Success) {
    $lines = $m.Groups['body'].Value -split "`r?`n"
    foreach ($line in $lines) {
      $trimmed = $line.Trim()
      if ($trimmed -match '^([a-zA-Z_][a-zA-Z0-9_]*)\s*,?\s*$') {
        [void]$names.Add($Matches[1])
      }
    }
  }
  return $names
}

$invoke = Get-FrontendInvokeCommands
$rustCmd = Get-RustCommandFunctions
$registered = Get-RegisteredCommands

$invokeNotRegistered = @($invoke | Where-Object { -not $registered.Contains($_) } | Sort-Object)
$cmdNotRegistered = @($rustCmd | Where-Object { -not $registered.Contains($_) } | Sort-Object)

Write-Host "Frontend invoke count: $($invoke.Count)"
Write-Host "Rust #[tauri::command] count: $($rustCmd.Count)"
Write-Host "Registered command count: $($registered.Count)"

if ($invokeNotRegistered.Count -gt 0) {
  Write-Host "`n[ERROR] Frontend invokes missing from generate_handler:"
  $invokeNotRegistered | ForEach-Object { Write-Host " - $_" }
}

if ($cmdNotRegistered.Count -gt 0) {
  Write-Host "`n[WARN] Rust commands not registered in generate_handler:"
  $cmdNotRegistered | ForEach-Object { Write-Host " - $_" }
}

if ($invokeNotRegistered.Count -gt 0) {
  exit 1
}

Write-Host "`nCommand contract check passed."
