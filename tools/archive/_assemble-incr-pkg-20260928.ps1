# _assemble-incr-pkg-20260928.ps1 - build the 2026-09-28 incremental deployment package
# Pure ASCII on purpose (PowerShell 5.1 reads a BOM-less .ps1 as ANSI).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_assemble-incr-pkg-20260928.ps1
$ErrorActionPreference = 'Stop'
$root  = (Get-Item (Join-Path $PSScriptRoot '..\..')).FullName   # tools/archive -> repo root
$pkg   = Join-Path $root 'deploy\pkg-incr-20260928'
$tools = Join-Path $pkg 'tools'
$lib   = Join-Path $tools 'lib'
$problems = New-Object System.Collections.ArrayList

function Copy-Verified {
  param([string]$From, [string]$To)
  if (-not (Test-Path -LiteralPath $From)) { [void]$problems.Add("SOURCE MISSING: $From"); return $false }
  Copy-Item -LiteralPath $From -Destination $To -Force -ErrorAction Stop
  if (-not (Test-Path -LiteralPath $To)) { [void]$problems.Add("COPY NOT ON DISK: $To"); return $false }
  if ((Get-Item -LiteralPath $From).Length -ne (Get-Item -LiteralPath $To).Length) { [void]$problems.Add("SIZE MISMATCH: $To"); return $false }
  return $true
}

if (Test-Path $tools) { Remove-Item $tools -Recurse -Force }
New-Item -ItemType Directory -Force -Path $lib | Out-Null

# 1) app.jar (freshly built: backend\target\app.jar staged into deploy\app.jar)
if (Copy-Verified (Join-Path $root 'deploy\app.jar') (Join-Path $pkg 'app.jar')) {
  Write-Host ("  app.jar copied ({0:N1} MB)" -f ((Get-Item (Join-Path $pkg 'app.jar')).Length / 1MB))
}

# 2) manifest + every script it lists (read manifest as UTF-8 explicitly: PS 5.1 pitfall)
Copy-Verified (Join-Path $root 'tools\db-migrations.txt') (Join-Path $tools 'db-migrations.txt') | Out-Null
$manifest = [System.IO.File]::ReadAllLines((Join-Path $root 'tools\db-migrations.txt'), (New-Object System.Text.UTF8Encoding($false))) |
  Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' } |
  ForEach-Object { $_.Trim() }
$distinct = @($manifest | Sort-Object -Unique)
$okCount = 0
foreach ($s in $distinct) { if (Copy-Verified (Join-Path $root "tools\$s") (Join-Path $tools $s)) { $okCount++ } }
Write-Host "  migration scripts verified: $okCount / $($distinct.Count) distinct (manifest entries: $($manifest.Count))"
if ($okCount -ne $distinct.Count) { [void]$problems.Add("SCRIPT COUNT $okCount <> $($distinct.Count)") }

# 3) toolchain + driver
Copy-Verified (Join-Path $root 'tools\DbSync.java') (Join-Path $tools 'DbSync.java') | Out-Null
Copy-Verified (Join-Path $root 'tools\lib\mssql-jdbc.jar') (Join-Path $lib 'mssql-jdbc.jar') | Out-Null

# 4) top-level helpers (to-run list is required by deploy-incremental.bat GO step 4)
foreach ($f in @('deploy-incremental.bat','apply-migrations.bat','verify-package.ps1','probe-login.ps1','steps.md','to-run-20260928.txt')) {
  Copy-Verified (Join-Path $root "deploy\$f") (Join-Path $pkg $f) | Out-Null
}

# 5) gates: package sql set == manifest distinct set; .bat pure ASCII + CRLF
$pkgSql = @(Get-ChildItem $tools -Filter '*.sql' -File | ForEach-Object { $_.Name } | Sort-Object)
$extra  = @(Compare-Object -ReferenceObject $distinct -DifferenceObject $pkgSql -PassThru |
            Where-Object { $_.SideIndicator -eq '=>' })
if ($extra.Count -gt 0) { [void]$problems.Add("IN PACKAGE BUT NOT IN MANIFEST: $($extra.Count)"); $extra | ForEach-Object { Write-Host "    EXTRA: $_" } }
$absent = @($distinct | Where-Object { -not (Test-Path (Join-Path $tools $_)) })
if ($absent.Count -gt 0) { [void]$problems.Add("ABSENT FROM PACKAGE: $($absent.Count)") }
foreach ($b in @('deploy-incremental.bat','apply-migrations.bat')) {
  $bp = Join-Path $pkg $b
  $raw = [System.IO.File]::ReadAllText($bp)
  $nonAscii = @($raw.ToCharArray() | Where-Object { [int]$_ -gt 126 -and [int]$_ -ne 13 -and [int]$_ -ne 10 })
  $bareLF = [regex]::IsMatch($raw, "(?<!`r)`n")
  if ($nonAscii.Count -gt 0) { [void]$problems.Add("BAT NON-ASCII x$($nonAscii.Count): $b") }
  if ($bareLF) { [void]$problems.Add("BAT HAS BARE LF: $b") }
  Write-Host ("  gate {0}: ascii={1} crlf={2}" -f $b, ($nonAscii.Count -eq 0), (-not $bareLF))
}

# 6) integrity manifest
$files = Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' }
$lines = foreach ($f in $files) {
  $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
  "$h  $($f.FullName.Substring($pkg.Length + 1))"
}
$lines | Set-Content (Join-Path $pkg 'SHA256SUMS.txt') -Encoding ASCII
Write-Host ("  SHA256SUMS.txt written ({0} files)" -f $lines.Count)

# 7) verdict
if ($problems.Count -gt 0) {
  Write-Host 'RESULT: FAIL-ASSEMBLY'
  $problems | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
$jh = (Get-FileHash -LiteralPath (Join-Path $pkg 'app.jar') -Algorithm SHA256).Hash
Write-Host "  app.jar SHA256: $jh"
Write-Host 'RESULT: ASSEMBLY-OK'
