@echo off
rem ==================================================================
rem  YINJIA-MES  FULL DEPLOYMENT  (route A: whole-database restore)
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE. A .bat that contains UTF-8 Chinese breaks
rem  in a zh-CN cmd console (the GBK parser chokes on it). All Chinese
rem  text lives in the .sql files, which sqlcmd reads as UTF-8
rem  (-f i:65001,o:65001), and lands in the returned log.
rem
rem  Run this ON THE SERVER:
rem    deploy-all.bat          CHECK - read-only: prerequisites + state.
rem    deploy-all.bat GO       DEPLOY - stop app, backup server DB,
rem                                     restore our DB, verify, swap
rem                                     app.jar, start, verify login.
rem    deploy-all.bat GO APP   swap app.jar only (DB untouched).
rem    deploy-all.bat GO DB    restore DB only (app.jar untouched).
rem
rem  What GO does, in order:
rem    1 prerequisites          2 server state (check-db.sql)
rem    3 stop app               4 backup server DB  (hard stop if it fails)
rem    5 restore our DB         6 verify restored DB
rem    7 swap app.jar           8 start app + real-login verification
rem
rem  Safety gates (kept from the proven 09-10/09-14 runs):
rem    * backup failure  -> hard stop, DB is never touched without a rollback point
rem    * restore markers -> missing RESULT lines stop the script
rem    * health 200 is NOT acceptance: probe-login.ps1 must return LOGIN-OK
rem      (Tomcat listens before its DB cache warms up and lies with a 200)
rem
rem  Logs: <this folder>\logs\deploy-<stamp>.log  (auto-returned to the
rem  dev machine through the RDP drive redirect) + logs\step-*.txt
rem  Exit codes: 0 ok  1 failed  2 prerequisites missing
rem ==================================================================
setlocal enabledelayedexpansion

set "MODE=%~1"
set "SCOPE=%~2"
if /i "%MODE%"=="GO" (set "MODE=GO") else (set "MODE=CHECK")
if /i "%SCOPE%"=="APP" (set "SCOPE=APP") else if /i "%SCOPE%"=="DB" (set "SCOPE=DB") else (set "SCOPE=ALL")

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=C:\yinjia"
if defined YJ_DEST set "DEST=%YJ_DEST%"
set "TASK=YINJIA-MES"
if defined YJ_TASK set "TASK=%YJ_TASK%"
set "BAK=%SRC%\HSDZ_MES.bak"
set "NEWJAR=%SRC%\app.jar"

rem Timestamp for file names: %DATE% is locale dependent (a zh-CN box yields
rem a string like "<weekday> 2026/09/21", which would put Chinese into every
rem archive/log file name). Ask PowerShell for an ASCII stamp instead.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%I"
if not defined STAMP set "STAMP=unknownstamp"
set "LOGDIR=%SRC%\logs"
set "CAMEHOME=1"
mkdir "%LOGDIR%" 2>nul
echo x > "%LOGDIR%\.wtest" 2>nul
if not exist "%LOGDIR%\.wtest" (
  set "LOGDIR=%DEST%\deploy-log"
  set "CAMEHOME=0"
) else (
  del /q "%LOGDIR%\.wtest" 2>nul
)
mkdir "%LOGDIR%" 2>nul
set "LOG=%LOGDIR%\deploy-%STAMP%.log"

call :main > "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
chcp 65001 >nul 2>nul
type "%LOG%"
echo.
echo log: %LOG%   (exit code %RC%)
exit /b %RC%

rem ==================================================================
:main
echo ================================================================
echo  YINJIA-MES FULL DEPLOY   MODE=%MODE%  SCOPE=%SCOPE%   %DATE% %TIME%
echo  pkg=%SRC%
echo  dest=%DEST%   task=%TASK%
echo ================================================================

rem ---- 1. prerequisites -------------------------------------------
echo.
echo [1/8] prerequisites
where sqlcmd >nul 2>nul
if errorlevel 1 ( echo RESULT: FAIL-NO-SQLCMD & exit /b 2 )
echo RESULT: SQLCMD-OK
where java >nul 2>nul
if errorlevel 1 ( echo RESULT: FAIL-NO-JAVA & exit /b 2 )
echo RESULT: JAVA-OK
if not exist "%DEST%" ( echo RESULT: FAIL-NO-DEST %DEST% & exit /b 2 )
echo RESULT: DEST-OK %DEST%
if not exist "%NEWJAR%" ( echo RESULT: FAIL-NO-NEW-JAR %NEWJAR% & exit /b 2 )
for %%F in ("%NEWJAR%") do echo RESULT: NEW-JAR %%~zF bytes  %%~tF
if "%SCOPE%"=="APP" goto :skip_bak_check
if not exist "%BAK%" ( echo RESULT: FAIL-NO-DB-BAK %BAK% & exit /b 2 )
for %%F in ("%BAK%") do echo RESULT: DB-BAK %%~zF bytes  %%~tF
:skip_bak_check
schtasks /query /tn "%TASK%" >nul 2>nul
if errorlevel 1 ( echo RESULT: WARN-NO-TASK %TASK% ) else ( echo RESULT: TASK-OK %TASK% )
if "%CAMEHOME%"=="1" ( echo RESULT: LOG-HOME-YES ) else ( echo RESULT: LOG-HOME-NO fallback=%LOGDIR% )

rem ---- 2. server state (read-only) --------------------------------
echo.
echo [2/8] server state (check-db.sql)
sqlcmd -S localhost -E -h -1 -W -f i:65001,o:65001 -i "%SRC%\check-db.sql"
if errorlevel 1 ( echo RESULT: FAIL-CHECKSQL & exit /b 1 )

rem ---- 2b. environment forensics (read-only) ----------------------
rem WHY: the server layout is NOT the same as the dev machine's. Dump what
rem actually exists so the deploy can be verified from the log alone:
rem which jar the scheduled task really starts, where the old DB backups
rem live, and what this package brought.
echo.
echo [2b/8] environment forensics
echo --- scheduled task ---
schtasks /query /tn "%TASK%" /fo list /v 2>nul | findstr /i "TaskName Task-To-Run Task To Run Start In Status"
schtasks /query /tn "%TASK%" /xml 2>nul | findstr /i "<Command> <Arguments> <WorkingDirectory>"
echo --- start-service.bat (first 25 lines, if present) ---
if exist "%DEST%\start-service.bat" (
  set "N=0"
  for /f "usebackq delims=" %%L in ("%DEST%\start-service.bat") do (
    set /a N+=1
    if !N! leq 25 echo   %%L
  )
) else (
  echo   (no start-service.bat in %DEST%)
)
echo --- %DEST% listing ---
dir /b "%DEST%" 2>nul
echo --- existing .bak in %DEST% ---
dir /b /o-d "%DEST%\*.bak" 2>nul
if exist "%DEST%\backup" (
  echo --- %DEST%\backup (newest 5) ---
  dir /b /o-d "%DEST%\backup" 2>nul | findstr /b /r "[1-5]:"
  dir /b /o-d "%DEST%\backup\*.bak" 2>nul | findstr /b /r "[1-5]:"
)
echo --- this package ---
dir /b "%SRC%" 2>nul

if /i not "%MODE%"=="GO" (
  echo.
  echo CHECK done - nothing was changed.
  echo To deploy:  deploy-all.bat GO
  exit /b 0
)

rem ---- 3. stop the app --------------------------------------------
echo.
echo [3/8] stop app
schtasks /end /tn "%TASK%" >nul 2>nul
taskkill /f /im java.exe >nul 2>nul
ping -n 4 127.0.0.1 >nul
tasklist /fi "imagename eq java.exe" | findstr /i "java.exe" >nul 2>nul
if not errorlevel 1 ( echo RESULT: FAIL-JAVA-STILL-RUNNING & exit /b 1 )
echo RESULT: APP-STOPPED

if /i "%SCOPE%"=="APP" goto :swap

rem ---- 4. backup the server DB (rollback point) --------------------
echo.
echo [4/8] backup server DB (backup-db.sql)
sqlcmd -S localhost -E -h -1 -W -f i:65001,o:65001 -i "%SRC%\backup-db.sql" > "%LOGDIR%\step-backup.txt" 2>&1
type "%LOGDIR%\step-backup.txt"
findstr /c:"RESULT: BACKUP-OK" "%LOGDIR%\step-backup.txt" >nul 2>nul
if errorlevel 1 (
  findstr /c:"RESULT: BACKUP-SKIPPED" "%LOGDIR%\step-backup.txt" >nul 2>nul
  if errorlevel 1 ( echo RESULT: FAIL-BACKUP & exit /b 1 )
)
echo RESULT: BACKUP-GATE-PASSED

rem ---- 5. restore our DB ------------------------------------------
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
echo.
echo [4b/8] stage our DB backup into %DEST%\HSDZ_MES.bak
echo RESULT: SRC-BAK-SIZE
for %%F in ("%BAK%") do echo   %%~zF bytes  %%~tF  %%~nxF
if exist "%DEST%\HSDZ_MES.bak" (
  if not exist "%DEST%\backup" mkdir "%DEST%\backup"
  move /y "%DEST%\HSDZ_MES.bak" "%DEST%\backup\HSDZ_MES.bak.old-%STAMP%" >nul
  if errorlevel 1 ( echo RESULT: FAIL-ARCHIVE-OLD-BAK & exit /b 1 )
  echo RESULT: OLD-BAK-ARCHIVED %DEST%\backup\HSDZ_MES.bak.old-%STAMP%
) else (
  echo RESULT: NO-PREVIOUS-BAK
)
copy /y "%BAK%" "%DEST%\HSDZ_MES.bak" >nul
if errorlevel 1 ( echo RESULT: FAIL-STAGE-BAK & exit /b 1 )
for %%F in ("%DEST%\HSDZ_MES.bak") do echo RESULT: STAGED-BAK-IN-PLACE %%~zF bytes  %%~tF

echo.
echo [5/8] restore our DB (restore-db.sql)
sqlcmd -S localhost -E -h -1 -W -f i:65001,o:65001 -i "%SRC%\restore-db.sql" > "%LOGDIR%\step-restore.txt" 2>&1
type "%LOGDIR%\step-restore.txt"
rem NOTE: the authoritative success marker is RESULT: RESTORE-DONE (printed only inside
rem the restore branch). Do NOT gate on "RESULT: DB-PRESENT" - when the guard stops the
rem restore, the OLD database is still there and would print that line too (fail-open:
rem we would swap the new jar onto the stale DB and call it a success).
set RESTORED=0
findstr /c:"RESULT: RESTORE-DONE" "%LOGDIR%\step-restore.txt" >nul 2>nul
if not errorlevel 1 set RESTORED=1
findstr /c:"RESULT: NOT-RESTORED" "%LOGDIR%\step-restore.txt" >nul 2>nul
if not errorlevel 1 if "%RESTORED%"=="0" echo RESULT: FAIL-RESTORE-GUARD-STOPPED - staged bak unreadable, server DB untouched
if "%RESTORED%"=="0" (
  echo RESULT: FAIL-RESTORE - no "RESULT: RESTORE-DONE" in step-restore.txt
  exit /b 1
)
echo RESULT: RESTORE-GATE-PASSED

rem ---- 6. verify restored data -----------------------------------
echo.
echo [6/8] verify restored data
sqlcmd -S localhost -E -h -1 -W -d HSDZ_MES -f i:65001,o:65001 -i "%SRC%\verify-db.sql" > "%LOGDIR%\step-verify.txt" 2>&1
type "%LOGDIR%\step-verify.txt"
findstr /c:"RESULT: DEMO-FILES 8" "%LOGDIR%\step-verify.txt" >nul 2>nul
if errorlevel 1 ( echo RESULT: WARN-DEMO-FILES-NOT-8 )
findstr /c:"RESULT: LOGIN-USER-OK" "%LOGDIR%\step-verify.txt" >nul 2>nul
if errorlevel 1 ( echo RESULT: FAIL-YINJIA-USER-MISSING & exit /b 1 )
echo RESULT: VERIFY-GATE-PASSED

rem ---- 6b. real SQL-login round trip (the cross-server SID trap) ----
echo.
echo [6b/8] SQL login round-trip as the application account
if not defined YJ_PASS set "YJ_PASS=Yinjia@2026"
sqlcmd -S localhost -U yinjia -P "%YJ_PASS%" -d HSDZ_MES -h -1 -W -Q "SET NOCOUNT ON; SELECT 'RESULT: SQL-LOGIN-OK'" > "%LOGDIR%\step-sqllogin.txt" 2>&1
type "%LOGDIR%\step-sqllogin.txt"
findstr /c:"RESULT: SQL-LOGIN-OK" "%LOGDIR%\step-sqllogin.txt" >nul 2>nul
if errorlevel 1 (
  echo RESULT: FAIL-SQL-LOGIN - yinjia cannot log in ^(orphaned login after restore^)
  echo hint: run fix-db-logins.sql, then deploy-all.bat GO DB
  exit /b 1
)
echo RESULT: SQL-LOGIN-GATE-PASSED

if /i "%SCOPE%"=="DB" (
  echo.
  echo DB restored. app.jar untouched (SCOPE=DB) - starting app back up.
  schtasks /run /tn "%TASK%" >nul 2>nul
  call :waitlogin
  exit /b !LOGINRC!
)

rem ---- 7. swap app.jar -------------------------------------------
:swap
echo.
echo [7/8] swap app.jar
if exist "%DEST%\app.jar" (
  if not exist "%DEST%\backup" mkdir "%DEST%\backup"
  copy /y "%DEST%\app.jar" "%DEST%\backup\app-%STAMP%.jar" >nul
  if errorlevel 1 ( echo RESULT: FAIL-ARCHIVE-OLD-JAR & exit /b 1 )
  echo RESULT: OLD-JAR-ARCHIVED %DEST%\backup\app-%STAMP%.jar
) else (
  echo RESULT: NO-OLD-JAR
)
copy /y "%NEWJAR%" "%DEST%\app.jar" >nul
if errorlevel 1 ( echo RESULT: FAIL-COPY-NEW-JAR & exit /b 1 )
for %%F in ("%DEST%\app.jar") do echo RESULT: NEW-JAR-IN-PLACE %%~zF bytes  %%~tF
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
rem (see deploy steps: staging our DB backup over the same-named old one / syncing update\app.jar)
if exist "%DEST%\update" (
  copy /y "%NEWJAR%" "%DEST%\update\app.jar" >nul
  if errorlevel 1 ( echo RESULT: WARN-UPDATE-JAR-COPY-FAILED ) else ( echo RESULT: UPDATE-JAR-SYNCED )
) else (
  echo RESULT: NO-UPDATE-DIR
)

rem ---- 8. start + verify -----------------------------------------
echo.
echo [8/8] start app + verify
schtasks /run /tn "%TASK%" >nul 2>nul
if errorlevel 1 (
  echo RESULT: WARN-TASK-RUN-FAILED
  if exist "%DEST%\start-service.bat" (
    start "" /b "%DEST%\start-service.bat"
    echo RESULT: FALLBACK-STARTER-USED
  ) else (
    echo RESULT: FAIL-NO-STARTER & exit /b 1
  )
) else (
  echo RESULT: TASK-STARTED
)
call :waitlogin
exit /b !LOGINRC!

rem ------------------------------------------------------------------
rem waitlogin: poll probe-login.ps1 (a REAL DB round-trip) up to 150s
:waitlogin
set "LOGINRC=1"
set "PROBE="
for /l %%I in (1,1,30) do (
  ping -n 6 127.0.0.1 >nul
  set "PROBE="
  for /f "usebackq tokens=*" %%L in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\probe-login.ps1"`) do set "PROBE=%%L"
  echo   attempt %%I: !PROBE!
  if "!PROBE!"=="LOGIN-OK" (
    echo RESULT: LOGIN-OK
    set "LOGINRC=0"
    goto :wl_done
  )
)
:wl_done
if not "!LOGINRC!"=="0" (
  echo RESULT: FAIL-LOGIN - no token in 150s. Application is NOT usable.
  echo hint: health 200 is not acceptance; check %DEST%\logs and task history
  exit /b 1
)
echo RESULT: ALL-OK
exit /b 0