Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FrontendInvokeCommands {
  $files = rg --files src | Where-Object { $_ -match '\.(ts|tsx|js|jsx)$' }
  $names = New-Object System.Collections.Generic.HashSet[string]
  foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $matches = [regex]::Matches($content, "invoke\('([a-zA-Z0-9_]+)'")
    foreach ($m in $matches) {
      [void]$names.Add($m.Groups[1].Value)
    }
  }
  return @($names | Sort-Object)
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
  return @($names | Sort-Object)
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
  return @($names | Sort-Object)
}

$invoke = Get-FrontendInvokeCommands
$rustCmd = Get-RustCommandFunctions
$registered = Get-RegisteredCommands

$invokeNotRegistered = @($invoke | Where-Object { $_ -notin $registered })
$registeredNotInvoked = @($registered | Where-Object { $_ -notin $invoke })
$cmdNotRegistered = @($rustCmd | Where-Object { $_ -notin $registered })

if (-not (Test-Path docs)) {
  New-Item -ItemType Directory -Path docs | Out-Null
}

$out = @()
$out += "# 命令矩阵报告"
$out += ""
$out += "生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$out += ""
$out += "- 前端 invoke 数：$($invoke.Count)"
$out += "- Rust #[tauri::command] 数：$($rustCmd.Count)"
$out += "- main.rs 注册命令数：$($registered.Count)"
$out += ""
$out += "## 前端调用但未注册（应为 0）"
$out += ""
if ($invokeNotRegistered.Count -eq 0) {
  $out += "- 无"
} else {
  $invokeNotRegistered | ForEach-Object { $out += "- $_" }
}
$out += ""
$out += "## 已注册但前端未调用（候选清理）"
$out += ""
if ($registeredNotInvoked.Count -eq 0) {
  $out += "- 无"
} else {
  $registeredNotInvoked | ForEach-Object { $out += "- $_" }
}
$out += ""
$out += "## 已标注 tauri::command 但未注册"
$out += ""
if ($cmdNotRegistered.Count -eq 0) {
  $out += "- 无"
} else {
  $cmdNotRegistered | ForEach-Object { $out += "- $_" }
}

$outPath = 'docs/命令矩阵报告.md'
$out | Set-Content $outPath -Encoding UTF8
Write-Host "Wrote $outPath"
