# =============================================================================
# apply.ps1 - backfill the work-order number of finished-goods receipts on the SERVER.
# PURE ASCII ON PURPOSE: PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so Chinese
# text here would arrive as mojibake. All Chinese docs live in README-AI.md.
#
# WHAT IT DOES (database only - it never touches app.jar, never restarts service)
#   1. preflight  : tables exist? how many receipts miss the work-order no? how many work orders?
#   2. report     : read-only, shows what WOULD be filled (4 sections)
#   3. strict     : fills only receipts whose product set is FULLY covered by one work
#                   order dated on/before the receipt date (<=180 days) - the safe tier
#   4. full       : fills every remaining blank receipt (M2 product match/time ok,
#                   M3 product match but work order dated AFTER the receipt,
#                   M4 no product evidence at all -> nearest work order by date)
#   5. summary    : per-tier counts + work-order rollup + M4 distance histogram
#
# SAFETY
#   * only blanks are filled: ISNULL(<work order no>,'') = '' -> existing values never touched
#   * one transaction per script; every guard failure rolls back
#   * one yj_usage_log row per changed receipt  -> auditable, and rollback.ps1 can undo
#   * idempotent: second run reports NOOP
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File apply.ps1                 # strict + full
#   powershell -ExecutionPolicy Bypass -File apply.ps1 -StrictOnly     # only the safe tier
#   powershell -ExecutionPolicy Bypass -File apply.ps1 -ReportOnly     # nothing is written
#
# RESULT LINES (last line is machine readable)
#   RESULT: FINISH-IN-WO-OK            strict + full executed and verified
#   RESULT: FINISH-IN-WO-STRICT-ONLY   only the strict tier executed
#   RESULT: FINISH-IN-WO-REPORT-ONLY   report printed, database untouched
#   RESULT: FAIL-NO-TABLE              bd_finish_in / bl_finish_in / plang missing
#   RESULT: FAIL-DB                    a script did not report success (see log)
# =============================================================================
param(
  [string]$Db        = 'HSDZ_MES',
  [string]$SqlServer = 'localhost',
  [int]   $SqlPort   = 1433,
  [string]$SqlUser   = 'yinjia',
  [string]$SqlPass   = $(if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' }),
  [switch]$ReportOnly,
  [switch]$StrictOnly
)

$ErrorActionPreference = 'Stop'
$pkg = $PSScriptRoot
$logDir = Join-Path $pkg 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$ts  = (Get-Date -Format 'yyyyMMdd-HHmmss')
$log = Join-Path $logDir "apply-$ts.log"

function Say([string]$msg) {
  Write-Host $msg
  Add-Content -LiteralPath $log -Value $msg -Encoding UTF8
}
function Fail([string]$code, [string]$why) {
  Say $why
  Say ''
  Say "RESULT: $code"
  exit 1
}

Say "=== apply finish-in work-order backfill  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Say "package : $pkg"
Say "database: $SqlServer`:$SqlPort/$Db   user=$SqlUser"

# ---------------------------------------------------------------- 0. preflight
# NOTE: do NOT probe java with `java -version` (stderr under ErrorActionPreference=Stop
# raises NativeCommandError and looks like "no java"). Resolve the path only.
$java = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" }
        else { (Get-Command java -ErrorAction SilentlyContinue).Source }
if (-not $java) { Fail 'FAIL-NO-JAVA' 'Java not found (no JAVA_HOME\bin\java.exe and no java on PATH).' }

$need = @(
  (Join-Path $pkg 'tools\SqlRunner.java'),
  (Join-Path $pkg 'tools\lib\mssql-jdbc.jar'),
  (Join-Path $pkg 'tools\finish-in-wo-preflight.sql'),
  (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-20261022.sql'),
  (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-full-20261022.sql'),
  (Join-Path $pkg 'tools\finish-in-wo-summary.sql'),
  (Join-Path $pkg 'verify\finish-in-wo-backfill-report.sql')
)
foreach ($f in $need) { if (-not (Test-Path $f)) { Fail 'FAIL-PKG-INCOMPLETE' "missing package file: $f" } }
Say '[0/5] preflight OK'

$jdbc = "jdbc:sqlserver://$SqlServer`:$SqlPort;databaseName=$Db;encrypt=false;trustServerCertificate=true"
function Run-Sql([string]$file) {
  $out = & $java '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' '-cp' (Join-Path $pkg 'tools\lib\mssql-jdbc.jar') `
         (Join-Path $pkg 'tools\SqlRunner.java') $jdbc $SqlUser $SqlPass $file 2>&1 | Out-String
  Add-Content -LiteralPath $log -Value $out -Encoding UTF8
  Write-Host $out
  return $out
}

# --------------------------------------------------------------- 1. preflight
Say '[1/5] checking tables and pending receipts ...'
$pre = Run-Sql (Join-Path $pkg 'tools\finish-in-wo-preflight.sql')
if ($pre -match 'PREFLIGHT-NO-TABLE') { Fail 'FAIL-NO-TABLE' '[STOP] bd_finish_in / bl_finish_in / plang not found - see README section 4A.' }
if ($pre -match 'PREFLIGHT-NO-PLANG') { Say '       [WARN] plang has 0 rows: nothing can be matched, scripts will report NOOP.' }
Say '[1/5] preflight SQL OK'

# ------------------------------------------------------------------ 2. report
Say '[2/5] read-only report (what would be filled) ...'
$rep = Run-Sql (Join-Path $pkg 'verify\finish-in-wo-backfill-report.sql')
if ($rep -notmatch 'RESULT: REPORT-OK') { Fail 'FAIL-DB' "[STOP] report did not finish. Log: $log" }
Say '[2/5] report OK'

if ($ReportOnly) {
  Say ''
  Say 'Report only. Database was NOT modified.'
  Say 'RESULT: FINISH-IN-WO-REPORT-ONLY'
  exit 0
}

# ------------------------------------------------------------------ 3. strict
Say '[3/5] tier 1 - strict (product set fully covered, work order on/before receipt) ...'
$strict = Run-Sql (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-20261022.sql')
if ($strict -notmatch 'RESULT: FINISH-IN-WO-(FILLED-\d+|NOOP)') { Fail 'FAIL-DB' "[STOP] strict tier failed. Log: $log" }
Say '[3/5] strict tier OK'

if ($StrictOnly) {
  Say ''
  Say 'Strict tier only; the loose tiers (M2/M3/M4) were NOT touched.'
  Say 'RESULT: FINISH-IN-WO-STRICT-ONLY'
  exit 0
}

# -------------------------------------------------------------------- 4. full
Say '[4/5] tier 2 - full (M2 product match, M3 work order after receipt, M4 nearest by date) ...'
$full = Run-Sql (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-full-20261022.sql')
if ($full -notmatch 'RESULT: FINISH-IN-WO-FULL-(\d+|NOOP)') { Fail 'FAIL-DB' "[STOP] full tier failed. Log: $log" }
Say '[4/5] full tier OK'

# ----------------------------------------------------------------- 5. summary
Say '[5/5] summary ...'
$sum = Run-Sql (Join-Path $pkg 'tools\finish-in-wo-summary.sql')
if ($sum -notmatch 'RESULT: SUMMARY-OK') { Fail 'FAIL-DB' "[STOP] summary did not finish. Log: $log" }
Say '[5/5] summary OK'

Say ''
Say 'Done. Panel: WMS -> Inventory Accounting -> Documents -> Finished Goods Receipt.'
Say 'Query bar has work-order-no / work-order-line-no - you can now filter receipts by work order no.'
Say 'To undo everything this package wrote: run rollback.ps1'
Say 'RESULT: FINISH-IN-WO-OK'
exit 0
