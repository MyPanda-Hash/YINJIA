@echo off
rem ==================================================================
rem  YINJIA-MES   push the LOCAL database onto this server
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE (see the note at the top of start.bat).
rem
rem  Run this ON THE SERVER:
rem    push-db.bat          CHECK - read only. verifies the .bak is reachable
rem                         through the RDP drive redirection and that
rem                         sqlcmd can reach the instance as sysadmin.
rem    push-db.bat GO       DO IT  - backup this server's DB, copy the local
rem                         .bak in, stop the app, RESTORE ... WITH REPLACE,
rem                         start the app, health-check.
rem
rem  DESTRUCTIVE: GO replaces the whole HSDZ_MES database on this server.
rem  It always takes a server-side backup first and refuses to continue
rem  if that backup fails. Rollback = re-run restore-local-bak.sql with
rem  the file it printed.
rem
rem  Exit codes: 0 ok  1 failed  2 prerequisites missing
rem ==================================================================
setlocal enabledelayedexpansion

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "TOOLS=%SRC%\db-tools"
set "DEST=C:\yinjia"
if defined YJ_DEST set "DEST=%YJ_DEST%"

if not defined YJ_PASS set "YJ_PASS=Yinjia@2026"
set "MODE=%~1"
if /i "%MODE%"=="GO" (set "MODE=GO") else ( if /i "%MODE%"=="FIX" (set "MODE=FIX") else (set "MODE=CHECK") )

rem where the .bak lives: in the package under db\ , OR beside this script
set "BAKSRC=%SRC%\db\HSDZ_MES_local.bak"
if not exist "%BAKSRC%" set "BAKSRC=%SRC%\HSDZ_MES_local.bak"

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
set "LOG=%LOGDIR%\push-db-%TS%.log"

> "%LOG%" echo push-db  mode=%MODE%  stamp=%TS%
>>"%LOG%" echo host    : %COMPUTERNAME%   user: %USERDOMAIN%\%USERNAME%
>>"%LOG%" echo src     : %SRC%
>>"%LOG%" echo bak src : %BAKSRC%
>>"%LOG%" echo --------------------------------------------------------------

echo.
echo ==================================================================
echo   YINJIA-MES push-db     mode=%MODE%
echo   bak source : %BAKSRC%
echo   log        : %LOG%
echo ==================================================================
if "%MODE%"=="GO" echo   GO WILL REPLACE the whole HSDZ_MES database on this server.
echo.

rem ---------------- prerequisites ----------------
echo [1/6] prerequisites ...
call :PREREQ >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_PREREQ

if "%MODE%"=="FIX" (
  echo [FIX] re-linking database logins only
  sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i "%TOOLS%\fix-db-logins.sql" >>"%LOG%" 2>&1
  echo [FIX] restarting backend ...
  taskkill /IM java.exe /F >>"%LOG%" 2>&1
  ping -n 4 127.0.0.1 >nul
  start "" cmd /c "%DEST%\start.bat"
  call :HEALTH >>"%LOG%" 2>&1
  call :VERIFY >>"%LOG%" 2>&1
  echo.
  powershell -NoProfile -Command "Get-Content -Encoding UTF8 '%LOG%' -Tail 34"
  goto :DONE
)
if "%MODE%"=="CHECK" (
  echo.
  echo   CHECK ok. Everything the GO step needs is reachable.
  echo   Run  push-db.bat GO  when you are ready.
  goto :DONE
)

rem ---------------- 2 backup ----------------
echo [2/6] backing up THIS server's database ...
call :BACKUP >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_BACKUP

rem ---------------- 3 copy the bak in ----------------
echo [3/6] copying the local .bak onto this server ...
mkdir "%DEST%\backup" 2>nul
copy /Y "%BAKSRC%" "%DEST%\backup\HSDZ_MES_local.bak" >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_COPY
>>"%LOG%" echo [ok] copied to %DEST%\backup\HSDZ_MES_local.bak

rem ---------------- 4 stop app ----------------
echo [4/6] stopping backend ...
taskkill /IM java.exe /F >>"%LOG%" 2>&1
ping -n 5 127.0.0.1 >nul

rem ---------------- 5 restore ----------------
echo [5/6] restoring (this takes a few seconds) ...
sqlcmd -S localhost -E -b -f i:65001,o:65001 -v BAK="%DEST%\backup\HSDZ_MES_local.bak" -i "%TOOLS%\restore-local-bak.sql" >>"%LOG%" 2>&1
if errorlevel 1 goto :FAIL_RESTORE
>>"%LOG%" echo [ok] restore finished
echo [5b/6] re-linking database logins (cross-server restore orphans them) ...
sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i "%TOOLS%\fix-db-logins.sql" >>"%LOG%" 2>&1
>>"%LOG%" echo [ok] login fix done

echo [6/6] starting backend ...
start "" cmd /c "%DEST%\start.bat"
call :HEALTH >>"%LOG%" 2>&1

call :VERIFY >>"%LOG%" 2>&1

>>"%LOG%" echo --------------------------------------------------------------
>>"%LOG%" echo DONE. Rollback file on this server: see "[ok] server backup:" above
copy /Y "%LOG%" "%LOGDIR%\push-db-last.log" >nul 2>&1
if "%LOGCAMEHOME%"=="0" ( mkdir "%SRC%\logs" 2>nul & copy /Y "%LOG%" "%SRC%\logs\" >nul 2>&1 )
echo.
echo   --- tail of log ---
powershell -NoProfile -Command "Get-Content -Encoding UTF8 '%LOG%' -Tail 30"
echo.
echo   Full log: %LOG%
goto :DONE

rem ==================================================================
rem  subroutines
rem ==================================================================
:PREREQ
echo -- java --
where java 2>&1
echo -- sqlcmd --
where sqlcmd 2>&1
if errorlevel 1 (echo [FATAL] sqlcmd not found on PATH & exit /b 1)
echo -- .bak source --
if not exist "%BAKSRC%" (echo [FATAL] .bak not found: %BAKSRC% & exit /b 2)
for %%f in ("%BAKSRC%") do echo     %%~zf bytes
echo -- instance reachable as sysadmin? --
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'OK ' + CAST(IS_SRVROLEMEMBER('sysadmin') AS varchar(1)) + ' ' + DB_NAME();"
if errorlevel 1 (echo [FATAL] sqlcmd -E failed on this server & exit /b 1)
echo -- target install dir --
if not exist "%DEST%" (echo [FATAL] %DEST% not found - is this really the MES server? & exit /b 2)
if not exist "%TOOLS%\restore-local-bak.sql" (echo [FATAL] restore-local-bak.sql missing & exit /b 2)
echo [ok] prerequisites
exit /b 0

:BACKUP
mkdir "%DEST%\backup" 2>nul
set "BAK=%DEST%\backup\server-before-push-%TS%.bak"
sqlcmd -S localhost -E -b -f 65001 -Q "BACKUP DATABASE HSDZ_MES TO DISK=N'%BAK%' WITH INIT, COMPRESSION"
if errorlevel 1 (echo [FATAL] server backup failed - refusing to replace the DB & exit /b 1)
echo [ok] server backup: %BAK%
exit /b 0

:HEALTH
echo -- waiting for backend on :8090 --
for /l %%i in (1,1,20) do (
  ping -n 4 127.0.0.1 >nul
  for /f "delims=" %%h in ('powershell -NoProfile -Command "try{(Invoke-WebRequest http://127.0.0.1:8090/ -UseBasicParsing -TimeoutSec 6).StatusCode}catch{0}" 2^>nul') do set "HS=%%h"
  echo   try %%i : !HS!
  if "!HS!"=="200" (echo [ok] backend is up & exit /b 0)
)
echo [WARN] backend did not answer on :8090
exit /b 1

:VERIFY
echo -- migration self check on the restored DB --
sqlcmd -S localhost -d HSDZ_MES -U yinjia -P "%YJ_PASS%" -f i:65001,o:65001 -i "%TOOLS%\check-migrations.sql" -o "%LOGDIR%\check-after-push.txt"
type "%LOGDIR%\check-after-push.txt"
exit /b 0

rem ==================================================================
rem  failures
rem ==================================================================
:FAIL_PREREQ
>>"%LOG%" echo [FATAL] prerequisites failed
echo.
echo   *** PREREQUISITES FAILED - nothing was changed ***
goto :DONE

:FAIL_BACKUP
>>"%LOG%" echo [FATAL] server backup failed - aborted before touching the DB
echo.
echo   *** BACKUP FAILED, NOTHING WAS REPLACED ***
goto :DONE

:FAIL_COPY
>>"%LOG%" echo [FATAL] could not copy the .bak onto this server
echo.
echo   *** COPY FAILED - nothing was replaced (app.jar untouched, DB untouched) ***
goto :DONE

:FAIL_RESTORE
>>"%LOG%" echo [FATAL] RESTORE failed - the DB may be in SINGLE_USER, fix it now
echo.
echo   *** RESTORE FAILED. The app is stopped. ***
echo   1) look at the log above
echo   2) put the DB back in multi-user:
echo        sqlcmd -S localhost -E -Q "ALTER DATABASE HSDZ_MES SET MULTI_USER"
echo   3) rollback with the server backup printed above:
echo        sqlcmd -S localhost -E -b -v BAK="<that .bak>" -i "%TOOLS%\restore-local-bak.sql"
echo   4) restart: start "" cmd /c "%DEST%\start.bat"
goto :DONE

:DONE
endlocal
exit /b 0
