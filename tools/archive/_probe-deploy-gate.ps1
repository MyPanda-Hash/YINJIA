# _probe-deploy-gate.ps1 - test the DB-restore GATE inside deploy\deploy-all.bat (2026-09-21)
#
# WHY: the gate used to accept "RESULT: DB-OK", which restore-db.sql also prints when the
# backup-file guard STOPS the restore (the old database is still there) => fail-open: the
# script would swap the new jar onto the stale DB and report ALL-OK. The fix moved the
# success marker to "RESULT: RESTORE-DONE" (printed only inside the restore branch).
#
# WHAT: this probe does NOT copy the gate logic (copy-paste drifts). It extracts the real
# gate block out of deploy\deploy-all.bat, wraps it in a throwaway .bat with a fake
# LOGDIR, and runs it against three synthetic step-restore.txt files:
#   case 1: no marker              -> FAIL-RESTORE, exit 1, must NOT reach step 6
#   case 2: NOT-RESTORED (guard)   -> GUARD-STOPPED + FAIL-RESTORE, exit 1, no step 6
#   case 3: RESTORE-DONE (real)    -> RESTORE-GATE-PASSED, exit 0, reaches step 6
#
# ASCII-ONLY ON PURPOSE (PS 5.1 reads BOM-less .ps1 as ANSI; see the .bat/.ps1 rules).
#
# Usage: powershell -NoProfile -File tools\archive\_probe-deploy-gate.ps1
$ErrorActionPreference = 'Stop'
$repo = 'C:\INCER\YINJIA-MES'
$bat = Join-Path $repo 'deploy\deploy-all.bat'
$tmp = Join-Path $env:TEMP 'yj-gate-probe'

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
$null = New-Item -ItemType Directory -Path $tmp -Force

# ---- extract the gate block from the real file -------------------------------
$lines = [IO.File]::ReadAllLines($bat, [Text.Encoding]::ASCII)
$start = -1; $end = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($start -lt 0 -and $lines[$i].Trim() -eq 'set RESTORED=0') { $start = $i }
  if ($start -ge 0 -and $lines[$i].Trim() -eq 'echo RESULT: RESTORE-GATE-PASSED') { $end = $i; break }
}
if ($start -lt 0 -or $end -lt 0) { throw "gate block not found in $bat (set RESTORED=0 .. RESULT: RESTORE-GATE-PASSED)" }
$gate = $lines[$start..$end]
Write-Host ("gate block: lines {0}-{1} of {2} ({3} lines)" -f ($start + 1), ($end + 1), $lines.Count, $gate.Count)

$harness = @('@echo off', ('set LOGDIR=' + $tmp)) + $gate + @('echo REACHED-STEP-6', 'exit /b 0')
$harnessPath = Join-Path $tmp 'gate-harness.bat'
[IO.File]::WriteAllLines($harnessPath, $harness, (New-Object Text.ASCIIEncoding))

# ---- run the three cases -----------------------------------------------------
$cases = @(
  @{ name = 'case 1: no marker at all';      body = @('USE master', 'some other output');
     exit = 1; gate = $false; guard = $false; reached = $false },
  @{ name = 'case 2: guard stopped restore'; body = @('[STOP] backup file unreadable', 'RESULT: NOT-RESTORED', 'RESULT: DB-PRESENT 442');
     exit = 1; gate = $false; guard = $true;  reached = $false },
  @{ name = 'case 3: restore succeeded';     body = @('[4/5] restore done', 'RESULT: RESTORE-DONE', 'RESULT: DB-PRESENT 442');
     exit = 0; gate = $true;  guard = $false; reached = $true }
)

$failed = 0
foreach ($c in $cases) {
  [IO.File]::WriteAllLines((Join-Path $tmp 'step-restore.txt'), $c.body, (New-Object Text.ASCIIEncoding))
  $out = (& cmd.exe /c "`"$harnessPath`"" 2>&1 | Out-String)
  $code = $LASTEXITCODE
  $got = @{
    exit    = $code
    gate    = [bool]($out -match 'RESULT: RESTORE-GATE-PASSED')
    guard   = [bool]($out -match 'FAIL-RESTORE-GUARD-STOPPED')
    reached = [bool]($out -match 'REACHED-STEP-6')
  }
  $ok = ($got.exit -eq $c.exit) -and ($got.gate -eq $c.gate) -and ($got.guard -eq $c.guard) -and ($got.reached -eq $c.reached)
  if (-not $ok) { $failed++ }

  Write-Host ''
  Write-Host ("--- {0}" -f $c.name)
  Write-Host ("    got  exit={0} gate={1} guard-stop={2} reached-step6={3}" -f $got.exit, $got.gate, $got.guard, $got.reached)
  Write-Host ("    want exit={0} gate={1} guard-stop={2} reached-step6={3}" -f $c.exit, $c.gate, $c.guard, $c.reached)
  Write-Host ("    verdict: {0}" -f $(if ($ok) { 'PASS' } else { 'FAIL' }))
}

Write-Host ''
Write-Host ("summary: {0}/3 cases pass" -f (3 - $failed))
Remove-Item $tmp -Recurse -Force
exit $failed
