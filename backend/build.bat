@echo off
chcp 65001 >nul
rem YINJIA-MES 后端构建(复用 light-mes 的 Maven 与 JDK)
setlocal
set "JAVA_HOME=D:\Program Files\Java\jdk-24"
set "MAVEN_HOME=C:\INCER\light-mes\tools\apache-maven-3.9.9"
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo [错误] 未找到 Maven: %MAVEN_HOME%(复用 light-mes 工具链)
  exit /b 1
)
cd /d "%~dp0"
call "%MAVEN_HOME%\bin\mvn.cmd" -q -s "C:\INCER\light-mes\tools\settings.xml" -DskipTests package
if errorlevel 1 (
  echo [错误] 构建失败
  exit /b 1
)
echo [OK] target\yinjia-mes-backend-0.1.0.jar
