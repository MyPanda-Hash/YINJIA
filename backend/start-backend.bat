@echo off
title YINJIA-MES backend (8090) - KEEP THIS WINDOW OPEN
rem Working dir must be repo root: ERP-push credential fallback reads {workdir}\deploy\push\config.json
cd /d %~dp0..

rem ---- JDK discovery: JAVA_HOME (version-gated) -> scan JDK dirs, accept first with major >= 25 ----
rem jar is class file 69 (pom java.version=25); JDK 23/24 fails with UnsupportedClassVersionError.
rem 2026-09-24: JAVA_HOME pointed to .jdks\openjdk-23.0.1 and old hardcoded-path logic crashed.
rem No hardcoded JDK names: every dir under .jdks / Program Files\Java is tried via its release file.
set "JAVA_EXE="
if defined JAVA_HOME call :TRYJDK "%JAVA_HOME%\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("%USERPROFILE%\.jdks\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("C:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("D:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE (
  echo [ERROR] JDK 25+ not found ^(pom java.version=25; install one under .jdks or Program Files\Java^)
  pause
  exit /b 1
)
echo [YINJIA-MES] backend 8090 starting with %JAVA_EXE%

:loop
"%JAVA_EXE%" -jar backend\target\yinjia-mes-backend-0.1.0.jar
echo.
echo Backend exited. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop

rem ---- subroutine: accept candidate java only when its JDK release declares major >= 25 ----
:TRYJDK
if defined JAVA_EXE goto :eof
if not exist %1 goto :eof
findstr /b /r /c:"JAVA_VERSION=.2[5-9]\." "%~dp1..\release" >nul && set "JAVA_EXE=%~f1"
goto :eof
