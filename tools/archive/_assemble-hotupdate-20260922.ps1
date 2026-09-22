# _assemble-hotupdate-20260922.ps1 - assemble 2026-09-22 hot-update package
# Pure ASCII (PS 5.1 reads no-BOM UTF-8 as ANSI; Chinese lives in the .md file)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = 'C:\INCER\YINJIA-MES'
$src = "$root\deploy\pkg-incr-20260922"
$prev = "$root\deploy\pkg-incr-20260921"

# -- clean + create dirs --
if (Test-Path $src) { Remove-Item $src -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$src\tools\lib", "$src\logs" | Out-Null

# -- 1. app.jar --
Copy-Item "$root\deploy\app.jar" "$src\app.jar" -Force
$jarMB = [math]::Round((Get-Item "$src\app.jar").Length / 1MB, 1)
Write-Host "  [1] app.jar ($jarMB MB)" -ForegroundColor Cyan

# -- 2. migration toolchain --
Copy-Item "$root\tools\DbSync.java"       "$src\tools\" -Force
Copy-Item "$root\tools\db-migrations.txt" "$src\tools\" -Force
Copy-Item "$root\tools\lib\mssql-jdbc.jar" "$src\tools\lib\" -Force
Write-Host "  [2] DbSync.java + db-migrations.txt + jdbc" -ForegroundColor Cyan

# -- 3. all .sql referenced in the manifest --
$manifest = Get-Content "$root\tools\db-migrations.txt" -Encoding UTF8
$sqlFiles = $manifest | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') } | ForEach-Object { $_.Trim() }
$copied = 0; $missing = @()
foreach ($f in $sqlFiles) {
  $p = "$root\tools\$f"
  if (Test-Path $p) { Copy-Item $p "$src\tools\" -Force; $copied++ }
  else { $missing += $f }
}
Write-Host "  [3] .sql scripts: $copied copied (missing: $($missing.Count))" -ForegroundColor Cyan
if ($missing.Count -gt 0) { $missing | ForEach-Object { Write-Host "      MISSING: $_" -ForegroundColor Red } }

# -- 4. server-side scripts (generic, reuse from prev package) --
foreach ($f in @('apply-migrations.bat', 'deploy-incremental.bat', 'probe-login.ps1')) {
  Copy-Item "$prev\$f" "$src\$f" -Force
}
Write-Host "  [4] server-side bat/ps1 scripts" -ForegroundColor Cyan

# -- 5. SHA256SUMS.txt --
$all = Get-ChildItem $src -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' }
$hashes = $all | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
  $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$h  $rel"
}
$hashes | Set-Content "$src\SHA256SUMS.txt" -Encoding ascii
Write-Host "  [5] SHA256SUMS.txt ($($hashes.Count) files)" -ForegroundColor Cyan

# -- 6. deployment steps (Chinese content from separate .md) --
$stepsFile = "$root\deploy\pkg-incr-20260922-steps.md"
if (Test-Path $stepsFile) {
  Copy-Item $stepsFile "$src\steps.md" -Force
  Write-Host "  [6] steps.md (Chinese deployment guide)" -ForegroundColor Cyan
} else {
  Write-Host "  [6] WARNING: steps.md source not found" -ForegroundColor Yellow
}

# -- 7. zip --
$zip = "$root\deploy\pkg-incr-20260922.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$src\*" -DestinationPath $zip -Force
$zipMB = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "===== HOT UPDATE PACKAGE READY =====" -ForegroundColor Yellow
Write-Host "  $zip ($zipMB MB)"
Write-Host "  Files: $($hashes.Count)"
$manifestCount = ($sqlFiles | Measure-Object).Count
Write-Host "  Manifest entries: $manifestCount"
Write-Host ""
Write-Host "  Server: copy zip -> extract to ASCII dir -> deploy-incremental.bat GO"
Write-Host "  Verify: powershell -File probe-login.ps1"
