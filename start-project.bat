@echo off
chcp 65001 >nul
rem YINJIA-MES one-click start: backend(8090) + frontend dev(5173)
setlocal

rem ---- JDK discovery: JAVA_HOME (version-gated) -> scan JDK dirs, accept first with major >= 25 ----
rem jar is class 69 (pom java.version=25); JDK 23/24 crashes.
rem 2026-09-24: JAVA_HOME=openjdk-23.0.1 accepted blindly by old hardcoded-path logic.
set "JAVA_HOME_25="
if defined JAVA_HOME call :TRYJDK "%JAVA_HOME%\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("%USERPROFILE%\.jdks\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("C:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("D:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 (
  echo [ERROR] JDK 25+ not found ^(pom java.version=25; install one under .jdks or Program Files\Java^)
  goto :fail
)
for %%i in ("%JAVA_HOME_25%") do set "JAVA_HOME=%%~dpi"
set "JAVA_HOME=%JAVA_HOME:~0,-1%"

if not exist "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar" (
  echo [TIP] backend not built yet, run backend\build.bat first
  goto :fail
)

rem aliyun keys: backend\.env (local, not in git); missing => translate/OCR degrade silently
if exist "%~dp0backend\.env" for /f "usebackq delims=" %%L in ("%~dp0backend\.env") do set "%%L"

rem ---- since 2026-09-24: incremental DB sync BEFORE start (fixes "code pulled but SQL not run") ----
rem Only new/changed scripts in db-migrations.txt are executed (idempotent); failure does NOT block start.
echo [0/3] syncing database (tools\db-migrations.txt incremental) ...
call "%~dp0tools\sync-db.bat"
if errorlevel 1 (
  echo.
  echo ============================================================
  echo [WARN] DB sync FAILED - UI/fields may not match the code!
  echo        Usual cause: SQL Server ^(Docker mssql2019^) not running.
  echo        Fix: start the DB, then re-run  tools\sync-db.bat
  echo ============================================================
  echo.
)

echo [1/3] starting backend http://localhost:8090 ...
start "YINJIA-MES backend" cmd /c ""%JAVA_HOME%\bin\java.exe" -jar "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar""

timeout /t 5 /nobreak >nul

echo [3/3] starting frontend http://localhost:5173 ...
cd /d "%~dp0frontend"
start "YINJIA-MES frontend" cmd /c "npm run dev"

echo.
echo done: open http://localhost:5173  (admin / 123456)
goto :eof

:fail
pause
exit /b 1

rem ---- subroutine: accept candidate java only when its JDK release declares major >= 25 ----
:TRYJDK
if defined JAVA_HOME_25 goto :eof
if not exist %1 goto :eof
findstr /b /r /c:"JAVA_VERSION=.2[5-9]\." "%~dp1..\release" >nul && for %%d in ("%~dp1..") do set "JAVA_HOME_25=%%~fd"
goto :eof
