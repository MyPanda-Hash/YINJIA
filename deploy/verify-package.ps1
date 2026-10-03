# verify-package.ps1 - verify every file listed in SHA256SUMS.txt against the package dir
# Pure ASCII on purpose (PS 5.1 reads a BOM-less .ps1 as ANSI).
# Usage (from anywhere): powershell -NoProfile -ExecutionPolicy Bypass -File verify-package.ps1
param([string]$Root = $PSScriptRoot)
$sums = Join-Path $Root 'SHA256SUMS.txt'
if (-not (Test-Path -LiteralPath $sums)) { Write-Host 'RESULT: FAIL-NO-SUMS'; exit 1 }
$n = 0; $bad = 0; $missing = 0
foreach ($line in [System.IO.File]::ReadAllLines($sums)) {
  if ($line.Trim().Length -lt 66) { continue }
  $h = $line.Substring(0, 64).Trim()
  $rel = $line.Substring(64).Trim()
  if ($rel -eq 'SHA256SUMS.txt') { continue }
  $n++
  $f = Join-Path $Root $rel
  if (-not (Test-Path -LiteralPath $f)) { $missing++; Write-Host "MISSING $rel"; continue }
  $a = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
  if ($a -ne $h) { $bad++; Write-Host "MISMATCH $rel" }
}
Write-Host "CHECKED=$n MISSING=$missing BAD=$bad"
if ($missing -eq 0 -and $bad -eq 0) { Write-Host 'RESULT: PACKAGE-OK'; exit 0 }
Write-Host 'RESULT: PACKAGE-BROKEN'
exit 1
