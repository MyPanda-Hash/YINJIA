@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PKG=%~dp0"
if "%PKG:~-1%"=="\" set "PKG=%PKG:~0,-1%"
if not exist "%PKG%\logs" mkdir "%PKG%\logs"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=%PKG%\logs\deploy-%TS%.log"
set "MODE=%~1"
set "SUB=%~2"
if "%MODE%"=="" set "MODE=CHECK"
set "TASKNAME=YINJIA-MES"
set "INSTALL=C:\yinjia"
set "BAKDIR=%INSTALL%\backup"

echo === deploy-incremental MODE=%MODE% SUB=%SUB% %DATE% %TIME% === >> "%LOG%"

REM ---- 0) package must not sit inside the install dir ----
if /i "%PKG:~0,9%"=="C:\yinjia" (
  echo RESULT: FAIL-PKG-IN-INSTALL-DIR
  echo [0] package dir inside install dir: %PKG% >> "%LOG%"
  echo Extract this package to its own dir like C:\yj-deploy and run again.
  exit /b 1
)

if /i "%MODE%"=="CHECK" goto preflight
if /i "%MODE%"=="GO" goto preflight
echo USAGE: deploy-incremental.bat [CHECK ^| GO ^| GO APP ^| GO DB]
echo   CHECK     read-only preflight, changes nothing
echo   GO        full flow: stop app, backup DB, run migrations, swap jar, start, verify
echo   GO APP    jar swap only, no DB steps
echo   GO DB     DB steps only, keep current jar
exit /b 2

:preflight
echo [1] preflight ...
echo [1] preflight >> "%LOG%"
where sqlcmd >nul 2>nul
if errorlevel 1 goto fail-sqlcmd
where java >nul 2>nul
if errorlevel 1 goto fail-java
if not exist "%INSTALL%" goto fail-installdir
if not exist "%INSTALL%\app.jar" goto fail-currentjar
if not exist "%PKG%\app.jar" goto fail-pkgfile
if not exist "%PKG%\tools\db-migrations.txt" goto fail-pkgfile
if not exist "%PKG%\tools\DbSync.java" goto fail-pkgfile
if not exist "%PKG%\tools\lib\mssql-jdbc.jar" goto fail-pkgfile
if not exist "%PKG%\probe-login.ps1" goto fail-pkgfile
if not exist "%PKG%\verify-package.ps1" goto fail-pkgfile
powershell -NoProfile -ExecutionPolicy Bypass -File "%PKG%\verify-package.ps1" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-pkgbroken
call sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'SYSADMIN='+CAST(IS_SRVROLEMEMBER('sysadmin') AS varchar(1)); SELECT 'DB_PRESENT='+CASE WHEN DB_ID('HSDZ_MES') IS NULL THEN '0' ELSE '1' END" -o "%PKG%\logs\pre-%TS%.txt" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-sqlcmd
findstr /c:"SYSADMIN=1" "%PKG%\logs\pre-%TS%.txt" >nul
if errorlevel 1 goto fail-sysadmin
findstr /c:"DB_PRESENT=1" "%PKG%\logs\pre-%TS%.txt" >nul
if errorlevel 1 goto fail-nodb
for /f %%c in ('dir /b "%PKG%\tools\*.sql" 2^>nul ^| find /c /v ""') do set "SQLCOUNT=%%c"
echo [1] preflight OK - package sql files: %SQLCOUNT%
echo [1] preflight OK - sql files %SQLCOUNT% >> "%LOG%"
echo RESULT: PREFLIGHT-OK
echo RESULT: PREFLIGHT-OK >> "%LOG%"
if /i "%MODE%"=="CHECK" (
  echo [CHECK] read-only check done. Next step: deploy-incremental.bat GO
  echo [CHECK] current jar hash: >> "%LOG%"
  certutil -hashfile "%INSTALL%\app.jar" SHA256 >> "%LOG%" 2>&1
  echo RESULT: CHECK-OK
  exit /b 0
)

REM ---- plan the GO variant ----
set "DOBACKUP=1"
set "DOMIG=1"
set "DOJAR=1"
if /i "%SUB%"=="APP" set "DOBACKUP=0"
if /i "%SUB%"=="APP" set "DOMIG=0"
if /i "%SUB%"=="DB" set "DOJAR=0"

REM ---- 2) stop app ----
echo [2] stopping app ...
echo [2] stop app >> "%LOG%"
schtasks /end /tn "%TASKNAME%" >> "%LOG%" 2>&1
taskkill /f /im java.exe >> "%LOG%" 2>&1
set /a WAITN=0
:waitstop
tasklist 2>nul | findstr /i "java.exe" >nul
if errorlevel 1 goto appstopped
timeout /t 2 /nobreak >nul
set /a WAITN+=1
if %WAITN% lss 15 goto waitstop
goto fail-appstop
:appstopped
REM 2026-09-28 incident fix: schtasks /end kills the task instance, but an orphaned
REM start-service.bat cmd loop can survive and keep restarting java every 5s, racing
REM the new instance for port 8090 (probe FAIL-LOGIN-TIMEOUT false negative). Kill
REM every start-service wrapper now; the schtasks /run in step [6] starts a fresh one.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*start-service*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >> "%LOG%" 2>&1
tasklist 2>nul | findstr /i "java.exe" >nul
if not errorlevel 1 (
  taskkill /f /im java.exe >> "%LOG%" 2>&1
  timeout /t 2 /nobreak >nul
)
echo RESULT: APP-STOPPED
echo RESULT: APP-STOPPED >> "%LOG%"

REM ---- 3) backup DB ----
if "%DOBACKUP%"=="0" goto migrate
if not exist "%BAKDIR%" mkdir "%BAKDIR%"
echo [3] backing up HSDZ_MES to %BAKDIR%\pre-deploy-%TS%.bak ...
echo [3] backup >> "%LOG%"
call sqlcmd -S localhost -E -Q "BACKUP DATABASE [HSDZ_MES] TO DISK = N'%BAKDIR%\pre-deploy-%TS%.bak' WITH FORMAT, INIT, STATS=25" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-backup
if not exist "%BAKDIR%\pre-deploy-%TS%.bak" goto fail-backup
for %%F in ("%BAKDIR%\pre-deploy-%TS%.bak") do set "BAKSIZE=%%~zF"
if %BAKSIZE% lss 10000000 goto fail-backup
echo RESULT: BACKUP-GATE-PASSED
echo RESULT: BACKUP-GATE-PASSED bak=%BAKSIZE% >> "%LOG%"

REM ---- 4) migrations ----
REM 2026-09-28 rehearsal finding: a bare `DbSync` (sync) on the server re-runs ~11 old
REM seed scripts whose bytes changed since 09-22 (stale hashes) and hard-fails on
REM _doc_part3_data.sql (Invalid column name). Correct sequence, same as the local
REM rehearsal that passed 84/84: force-run the curated to-run list, then baseline
REM (refresh stale hashes, no data), then a bare sync must be a clean no-op.
:migrate
if "%DOMIG%"=="0" goto swap
if not exist "%PKG%\to-run-20260930.txt" goto fail-norunlist
echo [4] migrations: force-run to-run list (22 entries: 22 new + 0 informed rerun) - detailed output in logs\deploy-%TS%.log ...
pushd "%PKG%\tools"
set "RUNFAILED=0"
for /f "usebackq eol=# delims=" %%s in ("%PKG%\to-run-20260930.txt") do (
  java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run %%s >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo    FAILED: %%s
    echo [4] run failed: %%s >> "%LOG%"
    set "RUNFAILED=1"
  )
)
if not "%RUNFAILED%"=="0" goto fail-migrations
echo [4b] baseline - refresh stale hashes only, no data touched ...
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java baseline >> "%LOG%" 2>&1
if errorlevel 1 goto fail-migrations
echo [4c] verify bare sync is a no-op ...
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java >> "%LOG%" 2>&1
set "MIGRC=%errorlevel%"
popd
if not "%MIGRC%"=="0" goto fail-migrations
echo RESULT: MIGRATIONS-OK
echo RESULT: MIGRATIONS-OK >> "%LOG%"

REM ---- 5) swap jar ----
:swap
if "%DOJAR%"=="0" goto start
echo [5] swapping app.jar - old jar archived to %BAKDIR%\app-%TS%.jar ...
copy /y "%INSTALL%\app.jar" "%BAKDIR%\app-%TS%.jar" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-archiveold
copy /y "%PKG%\app.jar" "%INSTALL%\app.jar" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-jarcopy
if exist "%INSTALL%\update" copy /y "%PKG%\app.jar" "%INSTALL%\update\app.jar" >nul 2>&1
echo RESULT: NEW-JAR-IN-PLACE
echo RESULT: NEW-JAR-IN-PLACE old=backup\app-%TS%.jar >> "%LOG%"

REM ---- 6) start app ----
:start
echo [6] starting app ...
schtasks /run /tn "%TASKNAME%" >> "%LOG%" 2>&1
echo RESULT: APP-STARTED
echo RESULT: APP-STARTED >> "%LOG%"

REM ---- 7) verify login ----
REM 2026-09-28 incident fix: the app restarts under start-service.bat and cold start
REM takes a few seconds; the old 150s window could expire during a port race and
REM report FAIL-LOGIN-TIMEOUT while the app was actually fine. Settle 15s first,
REM then probe up to 240s.
echo [7] verifying login - settle 15s then probe up to 240s ...
timeout /t 15 /nobreak >nul
set /a PROBEN=0
:probe
powershell -NoProfile -ExecutionPolicy Bypass -File "%PKG%\probe-login.ps1" > "%PKG%\logs\probe-%TS%.txt" 2>&1
findstr /c:"LOGIN-OK" "%PKG%\logs\probe-%TS%.txt" >nul
if not errorlevel 1 goto loginok
set /a PROBEN+=1
if %PROBEN% lss 48 (
  timeout /t 5 /nobreak >nul
  goto probe
)
goto fail-login
:loginok
echo RESULT: LOGIN-OK
echo RESULT: LOGIN-OK tries=%PROBEN% >> "%LOG%"
echo RESULT: ALL-OK
echo RESULT: ALL-OK >> "%LOG%"
exit /b 0

REM ---- failure exits ----
:fail-sqlcmd
echo RESULT: FAIL-NO-SQLCMD >> "%LOG%"
echo RESULT: FAIL-NO-SQLCMD - install SQL Server cmd tools or fix PATH
exit /b 1
:fail-java
echo RESULT: FAIL-NO-JAVA >> "%LOG%"
echo RESULT: FAIL-NO-JAVA - JDK 25 missing, see deploy doc section 1.4
exit /b 1
:fail-installdir
echo RESULT: FAIL-NO-INSTALL-DIR >> "%LOG%"
echo RESULT: FAIL-NO-INSTALL-DIR - %INSTALL% not found
exit /b 1
:fail-currentjar
echo RESULT: FAIL-NO-CURRENT-JAR >> "%LOG%"
echo RESULT: FAIL-NO-CURRENT-JAR - %INSTALL%\app.jar not found
exit /b 1
:fail-pkgfile
echo RESULT: FAIL-PKG-INCOMPLETE >> "%LOG%"
echo RESULT: FAIL-PKG-INCOMPLETE - a required package file is missing, see log
exit /b 1
:fail-pkgbroken
echo RESULT: FAIL-PACKAGE-BROKEN >> "%LOG%"
echo RESULT: FAIL-PACKAGE-BROKEN - SHA256SUMS mismatch, see log
exit /b 1
:fail-sysadmin
echo RESULT: FAIL-NOT-SYSADMIN >> "%LOG%"
echo RESULT: FAIL-NOT-SYSADMIN - sqlcmd -E is not sysadmin on localhost
exit /b 1
:fail-nodb
echo RESULT: FAIL-NO-HSDZ-MES >> "%LOG%"
echo RESULT: FAIL-NO-HSDZ-MES - database HSDZ_MES not found on localhost
exit /b 1
:fail-appstop
echo RESULT: FAIL-APP-STILL-RUNNING >> "%LOG%"
echo RESULT: FAIL-APP-STILL-RUNNING - java.exe did not exit within 30s
exit /b 1
:fail-backup
echo RESULT: FAIL-BACKUP >> "%LOG%"
echo RESULT: FAIL-BACKUP - no rollback point, nothing else was touched
exit /b 1
:fail-norunlist
echo RESULT: FAIL-NO-RUNLIST >> "%LOG%"
echo RESULT: FAIL-NO-RUNLIST - to-run-20260930.txt missing from package
exit /b 1
:fail-migrations
echo RESULT: FAIL-MIGRATIONS >> "%LOG%"
echo RESULT: FAIL-MIGRATIONS - DbSync exit %MIGRC%, jar NOT swapped, app stopped; see log tail
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 12"
exit /b 1
:fail-archiveold
echo RESULT: FAIL-ARCHIVE-OLD-JAR >> "%LOG%"
echo RESULT: FAIL-ARCHIVE-OLD-JAR - could not archive old jar; new jar NOT installed
exit /b 1
:fail-jarcopy
echo RESULT: FAIL-JAR-COPY >> "%LOG%"
echo RESULT: FAIL-JAR-COPY - copy failed; old jar kept in backup
exit /b 1
:fail-login
echo RESULT: FAIL-LOGIN-TIMEOUT >> "%LOG%"
echo RESULT: FAIL-LOGIN-TIMEOUT - app started but login never returned OK in 150s; check %LOG%
exit /b 1
