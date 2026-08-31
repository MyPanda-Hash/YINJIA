@echo off
chcp 65001 >nul
rem YINJIA-MES 后端构建(本地 Maven + 自动探测 JDK)
setlocal
cd /d "%~dp0"

rem ---- JDK 探测: JAVA_HOME -> 常见安装目录 -> PATH ----
if not defined JAVA_HOME goto :jdk_scan
if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
:jdk_scan
for %%D in ("C:\Program Files\Java\jdk-26.0.2" "D:\Program Files\Java\jdk-26.0.2" "D:\Program Files\Java\jdk-24" "C:\Program Files\Java\jdk-17") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul && goto :jdk_ok
echo [错误] 未找到 JDK(需要 17+)
exit /b 1
:jdk_ok

set "MAVEN_HOME=%~dp0..\tools\apache-maven-3.9.9"
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo [错误] 未找到 Maven: %MAVEN_HOME%(tools 下无 apache-maven-3.9.9)
  exit /b 1
)
set "YINJIA_M2_REPO=%~dp0..\.m2-repo"
call "%MAVEN_HOME%\bin\mvn.cmd" -q -s "%~dp0..\tools\settings.xml" -DskipTests package
if errorlevel 1 (
  echo [错误] 构建失败
  exit /b 1
)
echo [OK] target\yinjia-mes-backend-0.1.0.jar
