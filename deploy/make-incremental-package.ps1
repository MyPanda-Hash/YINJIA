# make-incremental-package.ps1 -- build a self-contained incremental deploy package
#
# ASCII ONLY ON PURPOSE: Windows PowerShell 5.1 reads a .ps1 without BOM as ANSI,
# so non-ASCII text breaks the parser (same rule as deploy\*.bat).
#
# WHY THIS EXISTS
#   deploy\deploy-incremental.bat requires the layout:
#       <PKG>\app.jar  +  <PKG>\tools\  +  the .bat files at the package root
#   (see its guard checks on lines 43-47). app.jar is excluded from git
#   (.gitignore: *.jar / target/) because a 93 MB binary would bloat history forever.
#   So: source code goes through git, the binary package goes through a share / Release.
#
# USAGE (repo root):
#   powershell -ExecutionPolicy Bypass -File deploy\make-incremental-package.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\make-incremental-package.ps1 -SkipZip
#
# OUTPUT
#   deploy\package-<yyyyMMdd-HHmmss>\      (+ the same name .zip)
#     app.jar                     <- backend\target\app.jar (built by rebuild-prod.ps1 / build-appjar.ps1)
#     deploy-production.bat etc.  <- copied from deploy\ (must sit at package root, they use %~dp0)
#     tools\db-migrations.txt     <- the single source of truth for migrations
#     tools\DbSync.java           <- migration runner
#     tools\lib\mssql-jdbc.jar    <- JDBC driver
#     tools\*.sql                 <- every migration script (DbSync runs the manifest)
#     部署说明.md / 部署步骤.md     <- operator manual
param([switch]$SkipZip)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$deploy = $PSScriptRoot
$jar = Join-Path $root 'backend\target\app.jar'
if (-not (Test-Path $jar)) { throw "app.jar not found: $jar -- run tools\scripts\rebuild-prod.ps1 or build-appjar.ps1 first" }

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$pkg = Join-Path $deploy "package-$ts"
New-Item -ItemType Directory -Force -Path $pkg, "$pkg\tools\lib" | Out-Null

Write-Host '[1/4] app.jar ...'
Copy-Item $jar (Join-Path $pkg 'app.jar') -Force

Write-Host '[2/4] deploy scripts and manuals ...'
$docs = @('deploy-production.bat', 'deploy-incremental.bat', 'apply-migrations.bat',
  ([string]([char]0x90E8) + [string]([char]0x7F72) + [string]([char]0x8BF4) + [string]([char]0x660E) + '.md'),
  ([string]([char]0x90E8) + [string]([char]0x7F72) + [string]([char]0x6B65) + [string]([char]0x9AA4) + '.md'),
  'check-db.sql', 'backup-db.sql', 'verify-db.sql', 'probe-login.ps1')
foreach ($f in $docs) {
  $src = Join-Path $deploy $f
  if (Test-Path $src) { Copy-Item $src $pkg -Force }
}

Write-Host '[3/4] tools (manifest + runner + driver + scripts) ...'
Copy-Item (Join-Path $root 'tools\db-migrations.txt') "$pkg\tools" -Force
Copy-Item (Join-Path $root 'tools\DbSync.java') "$pkg\tools" -Force
Copy-Item (Join-Path $root 'tools\lib\mssql-jdbc.jar') "$pkg\tools\lib" -Force
$sqlCount = (Get-ChildItem (Join-Path $root 'tools') -Filter '*.sql' -File).Count
Get-ChildItem (Join-Path $root 'tools') -Filter '*.sql' -File | Copy-Item -Destination "$pkg\tools" -Force
Copy-Item (Join-Path $root 'tools\db-legacy-whitelist.txt') "$pkg\tools" -Force -ErrorAction SilentlyContinue

# self check: the layout must satisfy deploy-incremental.bat guard checks
$need = @("$pkg\app.jar", "$pkg\tools\db-migrations.txt", "$pkg\tools\DbSync.java", "$pkg\tools\lib\mssql-jdbc.jar")
$missing = $need | Where-Object { -not (Test-Path $_) }
if ($missing) { throw "package layout incomplete: $($missing -join ', ')" }

$sha = (Get-FileHash (Join-Path $pkg 'app.jar') -Algorithm SHA256).Hash
Write-Host ("      migrations {0} files / app.jar SHA256 {1}" -f $sqlCount, $sha)

# SHA256SUMS.txt: deploy\verify-package.ps1 靠它逐件校验,包内所有文件都登记(它自己不登记)
Write-Host '      writing SHA256SUMS.txt ...'
$sums = Join-Path $pkg 'SHA256SUMS.txt'
$lines = New-Object System.Collections.Generic.List[string]
Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' } | ForEach-Object {
  $rel = $_.FullName.Substring($pkg.Length + 1)
  $h = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
  $lines.Add("$h  $rel")
}
$lines | Out-Null
# UTF-8 without BOM: the manuals are Chinese-named (部署说明.md) -- ASCII would turn them into "????.md"
# and verify-package.ps1 (ReadAllLines, auto-detects UTF-8) would then report MISSING.
[System.IO.File]::WriteAllLines($sums, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("      {0} files registered" -f $lines.Count)

if ($SkipZip) {
  Write-Host '[4/4] -SkipZip: no archive'
  Write-Host ''
  Write-Host "PACKAGE : $pkg"
} else {
  Write-Host '[4/4] compressing ...'
  $zip = Join-Path $deploy "package-$ts.zip"
  Compress-Archive -Path "$pkg\*" -DestinationPath $zip -CompressionLevel Optimal -Force
  $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
  Write-Host ''
  Write-Host "PACKAGE : $zip  ($mb MB)"
}
Write-Host "SHA256  : $sha"
Write-Host 'DEPLOY  : on the server -> deploy-production.bat CHECK  then  deploy-production.bat GO'
