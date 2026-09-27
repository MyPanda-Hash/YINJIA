@echo off
chcp 65001 >nul
rem YINJIA-MES backend build (local Maven + auto JDK discovery)
setlocal
cd /d "%~dp0"

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
  exit /b 1
)
for %%i in ("%JAVA_HOME_25%") do set "JAVA_HOME=%%~dpi"
set "JAVA_HOME=%JAVA_HOME:~0,-1%"

set "MAVEN_HOME=%~dp0..\tools\apache-maven-3.9.9"
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo [ERROR] Maven not found: %MAVEN_HOME% (no apache-maven-3.9.9 under tools)
  exit /b 1
)
set "YINJIA_M2_REPO=%~dp0..\.m2-repo"
call "%MAVEN_HOME%\bin\mvn.cmd" -q -s "%~dp0..\tools\settings.xml" -DskipTests package
if errorlevel 1 (
  echo [ERROR] build failed
  exit /b 1
)
echo [OK] target\yinjia-mes-backend-0.1.0.jar

rem ---- subroutine: accept candidate java only when its JDK release declares major >= 25 ----
:TRYJDK
if defined JAVA_HOME_25 goto :eof
if not exist %1 goto :eof
findstr /b /r /c:"JAVA_VERSION=.2[5-9]\." "%~dp1..\release" >nul && for %%d in ("%~dp1..") do set "JAVA_HOME_25=%%~fd"
goto :eof
