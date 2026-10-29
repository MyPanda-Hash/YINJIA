# =============================================================================
# rollback.ps1 - undo the "Production Picking" (PROD_PICK_LIST) increment.
# PURE ASCII ON PURPOSE (PowerShell 5.1 reads a BOM-less .ps1 as ANSI).
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File rollback.ps1            # jar only
#   powershell -ExecutionPolicy Bypass -File rollback.ps1 -Db        # jar + panel metadata
#   powershell -ExecutionPolicy Bypass -File rollback.ps1 -DbOnly    # panel metadata only
#
# It restores the newest C:\yinjia\backup\app-*.jar written by apply.ps1, restarts
# the service and drops the panel metadata (view / fields / grants / panel row /
# panel-scope translation). The data object dbo.outh itself is NEVER touched.
# RESULT: ROLLBACK-OK / FAIL-NO-BACKUPJAR / FAIL-STATIC / FAIL-DB
# =============================================================================
param(
  [string]$Db        = 'HSDZ_MES',
  [string]$SqlServer = 'localhost',
  [int]   $SqlPort   = 1433,
  [string]$SqlUser   = 'yinjia',
  [string]$SqlPass   = $(if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' }),
  [string]$AppDir    = 'C:\yinjia',
  [string]$TaskName  = 'YINJIA-MES',
  [switch]$Db,
  [switch]$DbOnly
)

$ErrorActionPreference = 'Stop'
$pkg = $PSScriptRoot
function Write-Step([string]$m) { Write-Host $m }

# ---------------------------------------------------------------- DB rollback
if ($Db -or $DbOnly) {
  $java = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" } else { 'java' }
  $sqlFile = Join-Path $pkg 'tools\rollback-prod-pick-outh-20261022.sql'
  if (-not (Test-Path $sqlFile)) { Write-Step "RESULT: FAIL-DB  (missing $sqlFile)"; exit 1 }
  $jdbc = "jdbc:sqlserver://$SqlServer`:$SqlPort;databaseName=$Db;encrypt=false;trustServerCertificate=true"
  Write-Step '[db] dropping panel metadata ...'
  $out = & $java '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' '-cp' (Join-Path $pkg 'tools\lib\mssql-jdbc.jar') `
         (Join-Path $pkg 'tools\SqlRunner.java') $jdbc $SqlUser $SqlPass $sqlFile 2>&1 | Out-String
  Write-Host $out
  if ($out -notmatch 'RESULT: PROD_PICK_LIST-ROLLED-BACK') { Write-Step 'RESULT: FAIL-DB'; exit 1 }
}

if ($DbOnly) { Write-Step 'RESULT: ROLLBACK-OK'; exit 0 }

# -------------------------------------------------------------- jar rollback
$bakDir = Join-Path $AppDir 'backup'
$bak = Get-ChildItem -Path $bakDir -Filter 'app-*.jar' -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $bak) { Write-Step "RESULT: FAIL-NO-BACKUPJAR  ($bakDir\app-*.jar not found)"; exit 1 }
$appJar = Join-Path $AppDir 'app.jar'
Write-Step "[jar] restoring $($bak.FullName) -> $appJar"

$task = schtasks /query /tn $TaskName 2>$null
if ($LASTEXITCODE -eq 0) { schtasks /end /tn $TaskName 2>&1 | Out-Null }
Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'app\.jar|yinjia-mes' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
for ($i = 0; $i -lt 60; $i++) {
  try { $fs = [System.IO.File]::Open($appJar, 'Open', 'ReadWrite', 'None'); $fs.Close(); $fs.Dispose(); break }
  catch { Start-Sleep -Seconds 1 }
}
Copy-Item -LiteralPath $bak.FullName -Destination $appJar -Force
if (-not (Test-Path $appJar)) { Write-Step 'RESULT: FAIL-STATIC'; exit 1 }

if (schtasks /query /tn $TaskName 2>$null) { schtasks /run /tn $TaskName 2>&1 | Out-Null }
Write-Step '[jar] restored, service restart requested'
Write-Step 'RESULT: ROLLBACK-OK'
exit 0
