@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PKG=%~dp0"
if "%PKG:~-1%"=="\" set "PKG=%PKG:~0,-1%"
if not exist "%PKG%\logs" mkdir "%PKG%\logs"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=%PKG%\logs\migrate-%TS%.log"
set "BAKDIR=C:\yinjia\backup"

echo === apply-migrations %DATE% %TIME% === >> "%LOG%"

echo [1] preflight ...
where sqlcmd >nul 2>nul
if errorlevel 1 goto fail-sqlcmd
where java >nul 2>nul
if errorlevel 1 goto fail-java
if not exist "%PKG%\tools\db-migrations.txt" goto fail-pkgfile
if not exist "%PKG%\tools\DbSync.java" goto fail-pkgfile
if not exist "%PKG%\tools\lib\mssql-jdbc.jar" goto fail-pkgfile
echo RESULT: PREFLIGHT-OK

if not exist "%BAKDIR%" mkdir "%BAKDIR%"
echo [2] backing up HSDZ_MES to %BAKDIR%\pre-migrate-%TS%.bak ...
call sqlcmd -S localhost -E -Q "BACKUP DATABASE [HSDZ_MES] TO DISK = N'%BAKDIR%\pre-migrate-%TS%.bak' WITH FORMAT, INIT, STATS=25" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-backup
if not exist "%BAKDIR%\pre-migrate-%TS%.bak" goto fail-backup
echo RESULT: BACKUP-GATE-PASSED

echo [3] migrations: force-run to-run list, then baseline, then verify sync ...
if not exist "%PKG%\to-run-20260928.txt" goto fail-norunlist
pushd "%PKG%\tools"
set "RUNFAILED=0"
for /f "usebackq eol=# delims=" %%s in ("%PKG%\to-run-20260928.txt") do (
  java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run %%s >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo    FAILED: %%s
    set "RUNFAILED=1"
  )
)
if not "%RUNFAILED%"=="0" goto fail-migrations
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java baseline >> "%LOG%" 2>&1
if errorlevel 1 goto fail-migrations
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java >> "%LOG%" 2>&1
set "MIGRC=%errorlevel%"
popd
if not "%MIGRC%"=="0" goto fail-migrations
echo RESULT: MIGRATIONS-OK
echo [done] jar untouched; app kept running - restart the app task if it should pick up new schema
exit /b 0

:fail-norunlist
echo RESULT: FAIL-NO-RUNLIST >> "%LOG%"
echo RESULT: FAIL-NO-RUNLIST - to-run-20260928.txt missing from package
exit /b 1

:fail-sqlcmd
echo RESULT: FAIL-NO-SQLCMD >> "%LOG%"
echo RESULT: FAIL-NO-SQLCMD
exit /b 1
:fail-java
echo RESULT: FAIL-NO-JAVA >> "%LOG%"
echo RESULT: FAIL-NO-JAVA
exit /b 1
:fail-pkgfile
echo RESULT: FAIL-PKG-INCOMPLETE >> "%LOG%"
echo RESULT: FAIL-PKG-INCOMPLETE - a required tools file is missing
exit /b 1
:fail-backup
echo RESULT: FAIL-BACKUP >> "%LOG%"
echo RESULT: FAIL-BACKUP - no rollback point, nothing else was touched
exit /b 1
:fail-migrations
echo RESULT: FAIL-MIGRATIONS >> "%LOG%"
echo RESULT: FAIL-MIGRATIONS - DbSync exit %MIGRC%, see log tail below
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 12"
exit /b 1
