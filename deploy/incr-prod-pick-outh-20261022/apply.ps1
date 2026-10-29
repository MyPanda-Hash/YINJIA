# =============================================================================
# apply.ps1 - install the "Production Picking" (PROD_PICK_LIST) panel, increment only.
# PURE ASCII ON PURPOSE: PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so Chinese
# text here would arrive as mojibake. All Chinese docs live in README-AI.md.
#
# WHAT IT DOES
#   1. (DB)  runs tools/migrate-prod-pick-outh-20261022.sql -> view + panel + fields + i18n + grants
#   2. (DB)  runs tools/verify-prod-pick-outh.sql            -> 13 read-only checks
#   3. (UI)  refreshes ONLY the frontend static content inside app.jar (menu entry),
#            so the new menu item appears under WMS -> Inventory Accounting -> Documents.
#   4. (UI)  restarts the service, waits for login, then runs the HTTP end-to-end check.
#
# DATA SOURCE (read-only, nothing is copied):
#   dbo.v_prod_pick_list = dbo.outh WHERE src = 6 (material issue) AND not deleted.
#   dbo.outh itself is NEVER modified (no DDL, no DML).
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File apply.ps1 -DbOnly      # database only
#   powershell -ExecutionPolicy Bypass -File apply.ps1              # database + frontend
#   powershell -ExecutionPolicy Bypass -File apply.ps1 -StaticOnly  # frontend only
#
# RESULT LINES (machine readable, printed on the last line)
#   RESULT: PROD-PICK-OK            everything asked for is installed and verified
#   RESULT: PROD-PICK-DB-OK         database part only (because -DbOnly)
#   RESULT: FAIL-NO-SOURCE-TABLE    dbo.outh not found - see README section 4A
#   RESULT: FAIL-DB                 migration or SQL verification failed
#   RESULT: FAIL-STATIC             jar/static swap failed (jar unchanged, see log)
#   RESULT: FAIL-E2E                panel installed but the HTTP check failed
# =============================================================================
param(
  [string]$Db        = 'HSDZ_MES',
  [string]$SqlServer = 'localhost',
  [int]   $SqlPort   = 1433,
  [string]$SqlUser   = 'yinjia',
  [string]$SqlPass   = $(if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' }),
  [string]$AppDir    = 'C:\yinjia',
  [string]$AppUrl    = 'http://127.0.0.1:8090',
  [string]$TaskName  = 'YINJIA-MES',
  [int]   $ExpectRows = 0,
  [switch]$DbOnly,
  [switch]$StaticOnly
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

Say "=== apply PROD_PICK_LIST  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Say "package : $pkg"
Say "database: $SqlServer`:$SqlPort/$Db   user=$SqlUser"
Say "app     : $AppDir\app.jar   url=$AppUrl"

# ---------------------------------------------------------------- 0. preflight
# NOTE: do NOT probe java by running `java -version` - under $ErrorActionPreference='Stop'
# its stderr output raises NativeCommandError and the catch block reports "no java" even
# when java exists. Resolve the path only.
$java = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" }
        else { (Get-Command java -ErrorAction SilentlyContinue).Source }
if (-not $java) { Fail 'FAIL-NO-JAVA' 'Java not found (no JAVA_HOME\bin\java.exe and no java on PATH). Install a JDK and retry.' }

$jarExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\jar.exe")) { "$env:JAVA_HOME\bin\jar.exe" }
          else { (Get-Command jar -ErrorAction SilentlyContinue).Source }
if (-not $DbOnly -and -not $jarExe) { Fail 'FAIL-NO-JAVA' 'jar.exe not found (needed to refresh the frontend inside app.jar). Set JAVA_HOME to a JDK and retry.' }

$need = @(
  (Join-Path $pkg 'tools\SqlRunner.java'),
  (Join-Path $pkg 'tools\lib\mssql-jdbc.jar'),
  (Join-Path $pkg 'tools\prod-pick-preflight.sql'),
  (Join-Path $pkg 'tools\migrate-prod-pick-outh-20261022.sql'),
  (Join-Path $pkg 'tools\verify-prod-pick-outh.sql')
)
if (-not $StaticOnly) {
  foreach ($f in $need) { if (-not (Test-Path $f)) { Fail 'FAIL-PKG-INCOMPLETE' "missing package file: $f" } }
}
if (-not $DbOnly) {
  if (-not (Test-Path (Join-Path $pkg 'static\index.html'))) { Fail 'FAIL-PKG-INCOMPLETE' 'static\index.html missing from package.' }
  if (-not (Test-Path (Join-Path $AppDir 'app.jar')))  { Fail 'FAIL-NO-APPJAR' "app.jar not found under $AppDir" }
}
Say '[0/4] preflight OK'

$jdbc = "jdbc:sqlserver://$SqlServer`:$SqlPort;databaseName=$Db;encrypt=false;trustServerCertificate=true"
function Run-Sql([string]$file) {
  $out = & $java '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' '-cp' (Join-Path $pkg 'tools\lib\mssql-jdbc.jar') `
         (Join-Path $pkg 'tools\SqlRunner.java') $jdbc $SqlUser $SqlPass $file 2>&1 | Out-String
  Add-Content -LiteralPath $log -Value $out -Encoding UTF8
  Write-Host $out
  return $out
}

# ------------------------------------------------------------------- 1. DB
if (-not $StaticOnly) {
  Say '[1/4] preflight: does dbo.outh exist? ...'
  $pre = Run-Sql (Join-Path $pkg 'tools\prod-pick-preflight.sql')
  if ($pre -match 'OUTH-MISSING') {
    Fail 'FAIL-NO-SOURCE-TABLE' @'
[STOP] dbo.outh (the inventory issue ledger) does not exist in this database.
       This panel reads it directly - nothing is created in its place.
       Check the object name first:
         SELECT name, type_desc FROM sys.objects WHERE name IN (N'outh', N'v_outh') ORDER BY name;
       See README section 4A.
'@
  }
  if ($pre -notmatch 'OUTH-OK') { Fail 'FAIL-DB' "[STOP] preflight did not report OUTH-OK. Log: $log" }

  Say '[1/4] migrating panel metadata (view + panel + fields + i18n + grants) ...'
  $mig = Run-Sql (Join-Path $pkg 'tools\migrate-prod-pick-outh-20261022.sql')
  if ($mig -notmatch 'RESULT: PROD_PICK_LIST-READY') { Fail 'FAIL-DB' "[STOP] migration did not report PROD_PICK_LIST-READY. Log: $log" }
  Say '[1/4] panel metadata OK'

  Say '[2/4] verifying (read-only, 13 checks) ...'
  $ver = Run-Sql (Join-Path $pkg 'tools\verify-prod-pick-outh.sql')
  if ($ver -notmatch 'RESULT: VERIFY-PASS') { Fail 'FAIL-DB' "[STOP] SQL verification failed. Log: $log" }
  Say '[2/4] SQL verification VERIFY-PASS'
} else {
  Say '[1/4] skipped (StaticOnly)'
  Say '[2/4] skipped (StaticOnly)'
}

if ($DbOnly) {
  Say ''
  Say 'Database part done. Frontend menu was NOT touched (-DbOnly).'
  Say 'RESULT: PROD-PICK-DB-OK'
  exit 0
}

# --------------------------------------------------------------- 3. static
Say '[3/4] swapping frontend static inside app.jar ...'
$appJar  = Join-Path $AppDir 'app.jar'
$bakDir  = Join-Path $AppDir 'backup'
if (-not (Test-Path $bakDir)) { New-Item -ItemType Directory -Path $bakDir | Out-Null }
$bakJar  = Join-Path $bakDir "app-$ts.jar"
Copy-Item -LiteralPath $appJar -Destination $bakJar -Force
Say "       old jar archived: $bakJar"

function Stop-App {
  $task = schtasks /query /tn $TaskName 2>$null
  if ($LASTEXITCODE -eq 0) { schtasks /end /tn $TaskName 2>&1 | Out-Null; Say '       schtasks /end done' }
  Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'app\.jar|yinjia-mes' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 60; $i++) {
    $busy = $false
    try { $fs = [System.IO.File]::Open($appJar, 'Open', 'ReadWrite', 'None'); $fs.Close(); $fs.Dispose() } catch { $busy = $true }
    if (-not $busy) { Say "       app stopped, jar is free ($i s)"; return }
    Start-Sleep -Seconds 1
  }
  Fail 'FAIL-STATIC' "[STOP] app.jar still locked after 60s. Jar NOT modified. Old jar: $bakJar"
}

Stop-App

$stage = Join-Path $env:TEMP ("yj-static-" + $ts)
$stageStatic = Join-Path $stage 'BOOT-INF\classes\static'
New-Item -ItemType Directory -Force -Path $stageStatic | Out-Null
Copy-Item -Path (Join-Path $pkg 'static\*') -Destination $stageStatic -Recurse -Force
Say "       staged $(@(Get-ChildItem $stageStatic -Recurse -File).Count) files"

Push-Location $stage
try {
  & $jarExe uf $appJar 'BOOT-INF'
  if ($LASTEXITCODE -ne 0) { throw "jar uf failed (exit $LASTEXITCODE)" }
} catch {
  Pop-Location
  Copy-Item -LiteralPath $bakJar -Destination $appJar -Force
  Fail 'FAIL-STATIC' "[STOP] jar update failed: $_. Old jar restored from $bakJar"
}
Pop-Location
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
Say '[3/4] static swapped (old hashed chunks remain in the jar; they are unreferenced and harmless)'

# --------------------------------------------------------------- 4. restart
Say '[4/4] restarting app ...'
$task = schtasks /query /tn $TaskName 2>$null
if ($LASTEXITCODE -eq 0) { schtasks /run /tn $TaskName 2>&1 | Out-Null; Say '       schtasks /run done' }
else { Say "       [WARN] scheduled task '$TaskName' not found - start the service the way your site does, then rerun the check below" }

$deadline = (Get-Date).AddSeconds(240)
$up = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 5
  try {
    $body = '{"userName":"admin","password":"123456"}'
    $r = Invoke-RestMethod -Uri "$AppUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 8
    if ($r.data.token) { $up = $true; break }
  } catch { }
}
if (-not $up) { Fail 'FAIL-E2E' "[STOP] app did not answer login within 240s. Old jar is at $bakJar (rollback.ps1 restores it)." }
Say '       login OK'

$node = Get-Command node -ErrorAction SilentlyContinue
$e2e = Join-Path $pkg 'verify\prod-pick-outh-e2e.mjs'
if ($node -and (Test-Path $e2e)) {
  Say '       running HTTP end-to-end check ...'
  $e2eArgs = @($e2e, '--url', $AppUrl, '--factory', 'YJ')
  if ($ExpectRows -gt 0) { $e2eArgs += @('--expect-total', "$ExpectRows") }
  $e2eOut = & node @e2eArgs 2>&1 | Out-String
  Add-Content -LiteralPath $log -Value $e2eOut -Encoding UTF8
  Write-Host $e2eOut
  if ($e2eOut -notmatch 'RESULT: PROD-PICK-E2E-PASS') { Fail 'FAIL-E2E' '[STOP] panel answered but the end-to-end check failed (see output above).' }
} else {
  Say '       [WARN] node.js not found - skipped the HTTP end-to-end check (login already proved the app runs)'
}

Say ''
Say 'Done. Menu: WMS Management -> Inventory Accounting -> Documents -> Production Picking (right after Material Issue).'
Say 'RESULT: PROD-PICK-OK'
exit 0
