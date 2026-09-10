@echo off
rem ==================================================================
rem  push-migrations.bat - run the data migrations a release needs
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE (zh-CN cmd reads bat as GBK).
rem  All scripts are idempotent; run from the RDP session as:
rem      \\tsclient\C\yj-deploy\push-migrations.bat
rem  Log is written next to this script (RDP redirected drive) and
rem  comes back to the developer machine for reading.
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
) do call :one "%%s"
echo.
    >>"%LOG%" echo ===== %%s =====
    sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i "%TOOLS%\%%s" >>"%LOG%" 2>&1
    if errorlevel 1 (
      echo [FAIL] %%s
      >>"%LOG%" echo [FAIL] %%s
      set "FAILED=1"
    ) else (
      echo [ok  ] %%s
      >>"%LOG%" echo [ok] %%s
    )
  ) else (
    echo [skip] %%s  (not in db-tools)
    >>"%LOG%" echo [skip] %%s - not found
  )
)

echo.
echo ----------------------------------------------
if "!FAILED!"=="1" (echo   RESULT: SOME MIGRATIONS FAILED - see the log) else (echo   RESULT: all migrations applied)
>>"%LOG%" echo ----------------------------------------------
if "!FAILED!"=="1" (>>"%LOG%" echo RESULT: SOME MIGRATIONS FAILED) else (>>"%LOG%" echo RESULT: all migrations applied)
rem ????:????? ?? for ?? if/else ?? cmd ??????????,?? [skip]
:one
set "S=%~1"
if not exist "%TOOLS%\%S%" (
  echo [skip] %S%  (not in db-tools)
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
copy /Y "%LOG%" "%LOGDIR%\migrations-last.log" >nul 2>&1
echo   Log: %LOG%
endlocal
exit /b 0
