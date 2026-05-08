Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$patterns = @(
  '�',          # replacement char
  '锛', '銆', '鈥', '鈩',
  '姝ｅ湪', '璇峰', '鍒囨崲', '鑷姩', '鏈', '鍙敤', '绠＄悊'
)

$ignoreDirs = @(
  'node_modules',
  'dist',
  'docs',
  '.git',
  'src-tauri/target',
  'src-tauri/gen/schemas'
)

function ShouldIgnorePath([string]$path) {
  foreach ($dir in $ignoreDirs) {
    if ($path -like "*$dir*") { return $true }
  }
  return $false
}

$files = rg --files . | Where-Object {
  $_ -match '\.(ts|tsx|js|jsx|json|rs|md|toml|yml|yaml|css|html)$' -and -not (ShouldIgnorePath $_)
}

$findings = @()
foreach ($file in $files) {
  $lines = @(Get-Content $file -Encoding UTF8)
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    foreach ($p in $patterns) {
      if ($line.Contains($p)) {
        $findings += [PSCustomObject]@{
          file = $file
          line = $i + 1
          text = $line.Trim()
          pattern = $p
        }
        break
      }
    }
  }
}

if ($findings.Count -eq 0) {
  Write-Host 'Encoding check passed: no suspicious mojibake pattern found.'
  exit 0
}

Write-Host "Found $($findings.Count) suspicious lines:"
$findings | Select-Object -First 120 | ForEach-Object {
  Write-Host ("{0}:{1}: {2}" -f $_.file, $_.line, $_.text)
}

if ($findings.Count -gt 120) {
  Write-Host "... and $($findings.Count - 120) more"
}

exit 1
