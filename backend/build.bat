@echo off
chcp 65001 >nul
rem YINJIA-MES backend build (local Maven + auto JDK detection)
setlocal
cd /d "%~dp0"

rem ---- JDK detection: JAVA_HOME -> common install dirs -> PATH ----
if not defined JAVA_HOME goto :jdk_scan
if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
:jdk_scan
for %%D in ("C:\Program Files\Java\jdk-25" "D:\Program Files\Java\jdk-25" "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul && goto :jdk_ok
echo [ERROR] JDK 25 not found
exit /b 1
:jdk_ok

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
