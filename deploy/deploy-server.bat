@echo off
rem ==================================================================
rem  YINJIA-MES   server-side one-click deploy   (route B: keep data)
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE: a .bat containing UTF-8 Chinese breaks in a
rem  zh-CN cmd console (see the note at the top of start.bat).
rem
rem  Run this ON THE SERVER:
rem    deploy.bat          CHECK  - read-only. prerequisites + DB self-check.
rem    deploy.bat GO       DEPLOY - stop app, backup DB, migrate, swap jar, start.
rem    deploy.bat GO DB    DEPLOY - database only; leave app.jar / service alone.
rem
rem  What GO does, in order:
rem    1 prerequisites   2 stop app      3 backup DB (hard stop if it fails)
rem    4 stage db-tools  5 baseline      6 run the 14 idempotent migrations
rem    7 re-check        8 swap app.jar  9 start app + health check
rem
rem  Never touched: the other 114 historical migrations in db-migrations.txt.
rem  They are only *registered* by baseline; nothing else is executed.
rem
rem  Optional env vars:
rem    YJ_PASS     password of the SQL login "yinjia"  (default: built-in)
rem    YJ_SA_PASS  password of "sa"; only used if the Windows-auth backup fails
rem
rem  Exit codes: 0 ok  1 failed  2 prerequisites missing
rem ==================================================================
setlocal enabledelayedexpansion
rem ENCODING STRATEGY - everything that lands in the log is forced to UTF-8:
rem   sqlcmd : -f i:65001,o:65001   (read UTF-8, write UTF-8)
rem   java   : -Dfile.encoding / -Dstdout.encoding / -Dstderr.encoding = UTF-8
rem           (DbSync mixes System.out and System.err, so ALL THREE are required;
rem            without stderr.encoding the [FATAL] lines come out as GBK)
rem   console: switched to 65001 only at display time, so it renders correctly
rem Never make the log depend on the host codepage - it is read back on another
rem machine and a mis-decoded log silently hides failed checks.

set "MODE=%~1"
set "SCOPE=%~2"
if /i "%MODE%"=="GO" (set "MODE=GO") else (set "MODE=CHECK")
if /i "%SCOPE%"=="DB" (set "SCOPE=DB") else (set "SCOPE=APP")

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "TOOLS=%SRC%\db-tools"
set "DEST=C:\yinjia"
if defined YJ_DEST set "DEST=%YJ_DEST%"
set "DTOOLS=%DEST%\tools"
if not defined YJ_PASS set "YJ_PASS=Yinjia@2026"

rem ---- log destination: prefer the folder we were launched from --------
set "LOGDIR=%SRC%\logs"
set "LOGCAMEHOME=1"
mkdir "%LOGDIR%" 2>nul
echo x > "%LOGDIR%\.wtest" 2>nul
if not exist "%LOGDIR%\.wtest" (
  set "LOGDIR=%DEST%\deploy-log"
  set "LOGCAMEHOME=0"
) else (
  del /q "%LOGDIR%\.wtest" 2>nul
)
mkdir "%LOGDIR%" 2>nul

set "TS=manual"
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss" 2^>nul') do set "TS=%%i"
set "LOG=%LOGDIR%\deploy-%TS%.log"
set "LATEST=%LOGDIR%\deploy-last.log"
set "CHK=%LOGDIR%\check-last.txt"

> "%LOG%" echo YINJIA-MES deploy  mode=%MODE%  scope=%SCOPE%  stamp=%TS%
>>"%LOG%" echo source   : %SRC%
>>"%LOG%" echo log      : %LOG%
>>"%LOG%" echo host     : %COMPUTERNAME%   user: %USERDOMAIN%\%USERNAME%
>>"%LOG%" echo ------------------------------------------------------------------

echo.
echo ==================================================================
echo   YINJIA-MES deploy     mode=%MODE%   scope=%SCOPE%
echo   source : %SRC%
echo   log    : %LOG%
echo ==================================================================
if "%MODE%"=="CHECK" echo   CHECK mode writes NOTHING to this server. Nothing is changed.
if "%MODE%"=="GO"    echo   GO mode will stop the app, backup the DB and migrate.
echo.

rem ==================================================================
rem  1  prerequisites
rem ==================================================================
echo [1/9] prerequisites ...
call :PREREQ >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_PREREQ

if "%MODE%"=="CHECK" goto :PHASE_CHECK
goto :PHASE_STOP

rem ==================================================================
rem  CHECK MODE: read-only self check, straight from the source folder
rem ==================================================================
:PHASE_CHECK
echo [2/9] DB self check (read-only) ...
call :SELFCHECK "%TOOLS%\check-migrations.sql" >>"%LOG%" 2>&1
echo [2b/9] dumping migration ledger + scale (read-only) ...
call :LEDGER >>"%LOG%" 2>&1
echo [2c/9] dumping view definitions ...
call :VIEWS >>"%LOG%" 2>&1
echo [2/9] done - verdict below
echo.
call :SHOWTAIL
echo.
echo   CHECK finished. Nothing on this server was modified.
echo   Run  deploy.bat GO  when you are ready.
goto :DONE

rem ==================================================================
rem  GO MODE
rem ==================================================================
:PHASE_STOP
echo [2/9] stopping backend (java.exe) ...
taskkill /IM java.exe /F >>"%LOG%" 2>&1
ping -n 4 127.0.0.1 >nul

echo [3/9] backing up database ...
call :LEDGER       rem ???????/??,????????(??)
echo == dump-schema-log.sql ==
sqlcmd -S localhost -d HSDZ_MES -U yinjia -P "%YJ_PASS%" -f i:65001,o:65001 -W -i "%TOOLS%\dump-schema-log.sql" -o "%LOGDIR%\server-ledger.txt"
type "%LOGDIR%\server-ledger.txt"
exit /b 0

:VIEWS        rem ????????(??)
echo == dump-server-views.sql ==
sqlcmd -S localhost -d HSDZ_MES -E -f i:65001,o:65001 -y 0 -i "%TOOLS%\dump-server-views.sql" -o "%LOGDIR%\server-views.sql"
echo [views] exit=%errorlevel%   file: %LOGDIR%\server-views.sql
exit /b 0

:BACKUP >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_BACKUP

echo [4/9] staging db-tools to %DTOOLS% ...
robocopy "%TOOLS%" "%DTOOLS%" /E /NFL /NDL /NJH /NP /R:2 /W:2 >>"%LOG%" 2>&1
if errorlevel 8 goto :FAIL_STAGE
>>"%LOG%" echo [ok] staged

echo [5/9] DbSync baseline (register only, execute nothing) ...
pushd "%DTOOLS%"
call :DBSYNC baseline >>"%LOG%" 2>&1
set "RC=!errorlevel!"
popd
>>"%LOG%" echo [baseline] exit=!RC!
if not "!RC!"=="0" goto :FAIL_BASELINE

echo [6/9] running the 14 idempotent migrations ...
call :RUNALL >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_RUN

echo [7/9] re-check + final sync probe ...
call :SELFCHECK "%DTOOLS%\check-migrations.sql" >>"%LOG%" 2>&1
pushd "%DTOOLS%"
call :DBSYNC sync >>"%LOG%" 2>&1
set "RC=!errorlevel!"
popd
>>"%LOG%" echo [sync probe] exit=!RC!  (expect: ran 0, skipped many, failed 0)
set "BAD=1"
rem ASCII-only verdict: only an explicit ALL-OK marker counts as success
powershell -NoProfile -Command "$t=Get-Content -Raw -Encoding UTF8 '%CHK%'; if($t -match 'RESULT:\s*ALL-OK'){exit 0}; exit 1" >>"%LOG%" 2>&1
if not errorlevel 1 set "BAD=0"
>>"%LOG%" echo [check] still-missing=!BAD!  (0 means every check passed)
if "!BAD!"=="1" goto :FAIL_VERIFY

if "%SCOPE%"=="DB" goto :PHASE_WHATHAPPENED

echo [8/9] swapping app.jar ...
if not exist "%SRC%\app.jar" goto :FAIL_NOJAR
mkdir "%DEST%\update" 2>nul
copy /Y "%DEST%\app.jar" "%DEST%\app.jar.bak" >>"%LOG%" 2>&1
copy /Y "%SRC%\app.jar" "%DEST%\update\app.jar" >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_NOJAR
copy /Y "%DEST%\update\app.jar" "%DEST%\app.jar" >>"%LOG%" 2>&1
del /Q "%DEST%\update\app.jar" 2>nul
>>"%LOG%" echo [ok] app.jar swapped (rollback: copy /Y %DEST%\app.jar.bak %DEST%\app.jar)

echo [9/9] starting backend ...
start "" cmd /c "%DEST%\start.bat"
call :HEALTH >>"%LOG%" 2>&1
goto :PHASE_WHATHAPPENED

:PHASE_WHATHAPPENED
>>"%LOG%" echo ------------------------------------------------------------------
if "!BAD!"=="1" (>>"%LOG%" echo VERDICT: some checks are still MISSING - see the table above) else (>>"%LOG%" echo VERDICT: all migration checks passed)
if "%SCOPE%"=="DB" (>>"%LOG%" echo NOTE: scope=DB - app.jar was NOT swapped and the service was left stopped by design) else (>>"%LOG%" echo NOTE: app.jar swapped and backend restarted)
copy /Y "%LOG%" "%LATEST%" >nul 2>&1
if "%LOGCAMEHOME%"=="0" (
  mkdir "%SRC%\logs" 2>nul
  copy /Y "%LOG%" "%SRC%\logs\" >nul 2>&1
)
echo.
call :SHOWTAIL
echo.
echo   Full log: %LOG%
goto :DONE

rem ==================================================================
rem  SUBROUTINES  (all output goes to the caller's stdout, i.e. the log)
rem ==================================================================

:PREREQ
echo -- java --
where java 2>&1
java -version 2>&1
if errorlevel 1 (echo [FATAL] java not found on PATH & exit /b 1)
echo -- sqlcmd --
where sqlcmd 2>&1
if errorlevel 1 (echo [FATAL] sqlcmd not found on PATH & exit /b 1)
echo -- dirs --
if not exist "%DEST%" (echo [FATAL] %DEST% not found - is this really the MES server? & exit /b 2)
if not exist "%TOOLS%\check-migrations.sql" (echo [FATAL] %TOOLS%\check-migrations.sql not found & exit /b 2)
if "%SCOPE%"=="APP" if not exist "%SRC%\app.jar" (echo [FATAL] %SRC%\app.jar not found & exit /b 2)
echo [ok] prerequisites
exit /b 0

:SELFCHECK     rem %1 = sql script path
echo == %~nx1 ==
sqlcmd -S localhost -d HSDZ_MES -U yinjia -P "%YJ_PASS%" -f i:65001,o:65001 -W -i "%~1" -o "%CHK%"
type "%CHK%"
exit /b 0

:LEDGER       rem ???????/??,????????(??)
echo == dump-schema-log.sql ==
sqlcmd -S localhost -d HSDZ_MES -U yinjia -P "%YJ_PASS%" -f i:65001,o:65001 -W -i "%TOOLS%\dump-schema-log.sql" -o "%LOGDIR%\server-ledger.txt"
type "%LOGDIR%\server-ledger.txt"
exit /b 0

:VIEWS        rem ????????(??)
echo == dump-server-views.sql ==
sqlcmd -S localhost -d HSDZ_MES -E -f i:65001,o:65001 -y 0 -i "%TOOLS%\dump-server-views.sql" -o "%LOGDIR%\server-views.sql"
echo [views] exit=%errorlevel%   file: %LOGDIR%\server-views.sql
exit /b 0

:BACKUP
mkdir "%DEST%\backup" 2>nul
set "BAK=%DEST%\backup\HSDZ_MES_before-%TS%.bak"
echo -- try Windows auth --
sqlcmd -S localhost -E -b -Q "BACKUP DATABASE HSDZ_MES TO DISK=N'%BAK%' WITH INIT, COMPRESSION"
if not errorlevel 1 (echo [ok] backup: %BAK% & exit /b 0)
echo -- Windows auth failed, trying sa --
if not defined YJ_SA_PASS (echo [FATAL] no YJ_SA_PASS set & exit /b 1)
sqlcmd -S localhost -U sa -P "%YJ_SA_PASS%" -b -Q "BACKUP DATABASE HSDZ_MES TO DISK=N'%BAK%' WITH INIT, COMPRESSION"
if errorlevel 1 (echo [FATAL] backup failed with sa too & exit /b 1)
echo [ok] backup: %BAK%
exit /b 0

:DBSYNC       rem %* = mode [script]
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp "lib;lib\mssql-jdbc.jar" DbSync %* 2>&1
if not errorlevel 1 exit /b 0
echo [warn] precompiled DbSync failed - retrying as single-file source ...
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp "lib\mssql-jdbc.jar" DbSync.java %* 2>&1
exit /b %errorlevel%

:RUNALL
set "FAILED=0"
for %%s in (
  migrate-rd-plan-stages.sql
  migrate-rd-docno-ref.sql
  migrate-rd-plan-docno-ref.sql
  fix-proj-customer-ref.sql
  migrate-aux-stock.sql
  migrate-aux-line-wh.sql
  migrate-product-lot-dualout.sql
  migrate-dualout-label.sql
  migrate-prod-forms-fields2.sql
  migrate-prod-forms-fields3.sql
  migrate-prod-forms-fields4.sql
  migrate-prod-forms-fix.sql
  migrate-view-id.sql
  migrate-view-ascancel.sql
) do (
  if not exist "%DTOOLS%\%%s" (
    echo [SKIP] %%s missing
  ) else (
    pushd "%DTOOLS%"
    call :DBSYNC run %%s
    set "R=!errorlevel!"
    popd
    if "!R!"=="0" (echo [OK]   %%s) else (echo [FAIL] %%s exit=!R! & set "FAILED=1")
  )
)
if "!FAILED!"=="1" (echo [FATAL] at least one migration failed - stopping & exit /b 1)
exit /b 0

:HEALTH
echo -- waiting for backend on :8090 --
for /l %%i in (1,1,20) do (
  ping -n 4 127.0.0.1 >nul
  for /f "delims=" %%h in ('powershell -NoProfile -Command "try{(Invoke-WebRequest http://127.0.0.1:8090/ -UseBasicParsing -TimeoutSec 6).StatusCode}catch{0}" 2^>nul') do set "HS=%%h"
  echo   try %%i : !HS!
  if "!HS!"=="200" (echo [ok] backend is up & exit /b 0)
)
echo [WARN] backend did not answer on :8090 within 80s - watch the java window
exit /b 1

:SHOWTAIL
chcp 65001 >nul
powershell -NoProfile -Command "Get-Content -Encoding UTF8 '%LOG%' -Tail 42"
exit /b 0

rem ==================================================================
rem  failure exits
rem ==================================================================
:FAIL_PREREQ
>>"%LOG%" echo [FATAL] prerequisites failed
echo.
echo   *** PREREQUISITES FAILED - see the log ***
goto :DONE

:FAIL_BACKUP
>>"%LOG%" echo [FATAL] backup failed - refusing to migrate without a backup
echo.
echo   *** BACKUP FAILED. Nothing was changed. ***
echo   Do a manual backup in SSMS first, or rerun with:
echo       set YJ_SA_PASS=<sa password>
echo       deploy.bat GO
goto :DONE

:FAIL_STAGE
>>"%LOG%" echo [FATAL] robocopy to %DTOOLS% failed
echo.
echo   *** STAGING FAILED (app is stopped!). Restart it: start "" cmd /c "%DEST%\start.bat" ***
goto :DONE

:FAIL_BASELINE
>>"%LOG%" echo [FATAL] DbSync baseline failed
echo.
echo   *** BASELINE FAILED (app is stopped and NOT swapped). ***
echo   Rollback is trivial: nothing was migrated. Start the app again:
echo       start "" cmd /c "%DEST%\start.bat"
goto :DONE

:FAIL_RUN
>>"%LOG%" echo [FATAL] a migration failed
echo.
echo   *** A MIGRATION FAILED. ***
echo   The app.jar was NOT swapped. Look at the log, then either fix and
echo   rerun (scripts are idempotent) or start the old app again:
echo       start "" cmd /c "%DEST%\start.bat"
goto :DONE

:FAIL_NOJAR
>>"%LOG%" echo [FATAL] app.jar missing / copy failed - DB was migrated but jar NOT swapped
echo.
echo   *** JAR SWAP FAILED (DB already migrated - that is fine backwards compatible). ***
echo   Check %SRC%\app.jar, then:
echo       copy /Y "%SRC%\app.jar" "%DEST%\update\app.jar"
echo       "%DEST%\update.bat"
goto :DONE

:FAIL_VERIFY
>>"%LOG%" echo [FATAL] re-check still reports missing items - NOT swapping app.jar
copy /Y "%LOG%" "%LATEST%" >nul 2>&1
echo.
echo   *** STILL MISSING CHECKS. app.jar was NOT swapped (that is the safe side). ***
echo   The app is stopped. Start the old build again with:
echo       start "" cmd /c "%DEST%\start.bat"
echo   Then send me this log:
echo       %LOG%
goto :DONE

:DONE
endlocal
exit /b 0
