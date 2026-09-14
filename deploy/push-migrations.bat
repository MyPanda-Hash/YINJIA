@echo off
rem ==================================================================
rem  push-migrations.bat - run the data migrations a release needs
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE (zh-CN cmd reads bat as GBK).
rem  All scripts are idempotent; run from the RDP session as:
rem      \\tsclient\C\yj-deploy\push-migrations.bat
rem  Log is written next to this script (RDP redirected drive) and
rem  comes back to the developer machine for reading.
rem
rem  2026-09-14 fix (pre-deploy health check):
rem   - the old file had orphaned leftover lines after "do call :one"
rem     (a half-deleted for-body). They ran a bogus sqlcmd with a
rem     literal %s filename, forced FAILED=1 ("SOME MIGRATIONS FAILED"
rem     false alarm) and could abort the batch mid-run. The :one calls
rem     never executed, so the real migrations were silently skipped.
rem   - migrations-last.log copy lived AFTER "exit /b 0" (dead code);
rem     moved before it.
rem   - added the 2026-09-11/12 scripts required by the new jar:
rem     applicant-lock / merged-panels / rd-spec-assign (all idempotent,
rem     all registered in tools/db-migrations.txt).
rem   - the stub harness (sqlcmd commented out) verified the fixed
rem     control flow 6/6 on 2026-09-14; this production copy has the
rem     sqlcmd line LIVE.
rem ==================================================================
setlocal enabledelayedexpansion

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "TOOLS=%SRC%\db-tools"
set "DEST=C:\yinjia"
if defined YJ_DEST set "DEST=%YJ_DEST%"

set "LOGDIR=%SRC%\logs"
mkdir "%LOGDIR%" 2>nul
set "TS=manual"
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss" 2^>nul') do set "TS=%%i"
set "LOG=%LOGDIR%\migrations-%TS%.log"

> "%LOG%" echo migrations %TS%
>>"%LOG%" echo host   : %COMPUTERNAME%
>>"%LOG%" echo tools  : %TOOLS%
>>"%LOG%" echo ----------------------------------------------

echo.
echo ==================================================================
echo   YINJIA-MES data migrations
echo ==================================================================

set "FAILED=0"
for %%s in (
  migrate-clean-orphan-docstatus.sql
  migrate-progress-single-doc.sql
  migrate-lab-stdlib.sql
  migrate-applicant-lock.sql
  migrate-merged-panels.sql
  migrate-rd-spec-assign.sql
) do call :one "%%s"

echo.
echo ----------------------------------------------
if "!FAILED!"=="1" (echo   RESULT: SOME MIGRATIONS FAILED - see the log) else (echo   RESULT: all migrations applied)
>>"%LOG%" echo ----------------------------------------------
if "!FAILED!"=="1" (>>"%LOG%" echo RESULT: SOME MIGRATIONS FAILED) else (>>"%LOG%" echo RESULT: all migrations applied)
copy /Y "%LOG%" "%LOGDIR%\migrations-last.log" >nul 2>&1
echo   Log: %LOG%
endlocal
exit /b 0

:one
set "S=%~1"
if not exist "%TOOLS%\%S%" (
  echo [skip] %S% - not in db-tools
  >>"%LOG%" echo [skip] %S% - not found
  exit /b 0
)
echo [run ] %S%
>>"%LOG%" echo.
>>"%LOG%" echo ===== %S% =====
sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i "%TOOLS%\%S%" >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [FAIL] %S%
  >>"%LOG%" echo [FAIL] %S%
  set "FAILED=1"
) else (
  echo [ok  ] %S%
  >>"%LOG%" echo [ok] %S%
)
exit /b 0
