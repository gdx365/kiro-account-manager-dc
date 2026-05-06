Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$deprecated = Get-Content ./scripts/deprecated-commands.json -Raw | ConvertFrom-Json

$files = rg --files src | Where-Object { $_ -match '\.(ts|tsx|js|jsx)$' }
$found = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
  $content = Get-Content $file -Raw
  $matches = [regex]::Matches($content, "invoke(?:<[^>]+>)?\('([a-zA-Z0-9_]+)'")
  foreach ($m in $matches) {
    $cmd = $m.Groups[1].Value
    if ($cmd -in $deprecated) {
      $found.Add([PSCustomObject]@{
        file = $file
        command = $cmd
      })
    }
  }

  $wrapperMatches = [regex]::Matches($content, "runKiroCommand\('([a-zA-Z0-9_]+)'")
  foreach ($m in $wrapperMatches) {
    $cmd = $m.Groups[1].Value
    if ($cmd -in $deprecated) {
      $found.Add([PSCustomObject]@{
        file = $file
        command = $cmd
      })
    }
  }
}

if ($found.Count -eq 0) {
  Write-Host "Deprecated invoke check passed."
  exit 0
}

Write-Host "[ERROR] Found deprecated commands invoked by frontend:"
$found | ForEach-Object {
  Write-Host (" - {0}: {1}" -f $_.file, $_.command)
}

exit 1
