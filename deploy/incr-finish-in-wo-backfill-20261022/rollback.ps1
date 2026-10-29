# =============================================================================
# rollback.ps1 - undo the finished-goods work-order backfill written by apply.ps1.
# PURE ASCII ON PURPOSE (PowerShell 5.1 reads a BOM-less .ps1 as ANSI).
#
# WHAT IT DOES (database only)
#   Reads yj_usage_log rows written by the backfill (panel_name = finished-goods receipt),
#   For each receipt whose work-order no STILL equals the value written, it clears the
#   work-order no and work-order-line no. Receipts edited by hand afterwards are kept
#   as-is (their new value is the new fact). Log rows are then marked as rolled back,
#   so a second run cannot undo someone else's work.
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File rollback.ps1
#
# RESULT: ROLLBACK-OK / FAIL-DB
# =============================================================================
param(
  [string]$Db        = 'HSDZ_MES',
  [string]$SqlServer = 'localhost',
  [int]   $SqlPort   = 1433,
  [string]$SqlUser   = 'yinjia',
  [string]$SqlPass   = $(if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' })
)

$ErrorActionPreference = 'Stop'
$pkg = $PSScriptRoot
$logDir = Join-Path $pkg 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$ts  = (Get-Date -Format 'yyyyMMdd-HHmmss')
$log = Join-Path $logDir "rollback-$ts.log"

function Say([string]$msg) {
  Write-Host $msg
  Add-Content -LiteralPath $log -Value $msg -Encoding UTF8
}

$java = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" }
        else { (Get-Command java -ErrorAction SilentlyContinue).Source }
if (-not $java) { Say 'RESULT: FAIL-NO-JAVA'; exit 1 }

$sqlFile = Join-Path $pkg 'tools\rollback-finish-in-wo-backfill-20261022.sql'
if (-not (Test-Path $sqlFile)) { Say "RESULT: FAIL-DB  (missing $sqlFile)"; exit 1 }

$jdbc = "jdbc:sqlserver://$SqlServer`:$SqlPort;databaseName=$Db;encrypt=false;trustServerCertificate=true"
Say "=== rollback finish-in work-order backfill  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Say "database: $SqlServer`:$SqlPort/$Db"
Say '[1/1] reverting rows recorded in yj_usage_log ...'

$out = & $java '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' '-cp' (Join-Path $pkg 'tools\lib\mssql-jdbc.jar') `
       (Join-Path $pkg 'tools\SqlRunner.java') $jdbc $SqlUser $SqlPass $sqlFile 2>&1 | Out-String
Add-Content -LiteralPath $log -Value $out -Encoding UTF8
Write-Host $out

if ($out -notmatch 'RESULT: FINISH-IN-WO-ROLLED-BACK-\d+') {
  Say ''
  Say 'RESULT: FAIL-DB'
  exit 1
}
Say ''
Say 'RESULT: ROLLBACK-OK'
exit 0
