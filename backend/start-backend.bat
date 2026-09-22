@echo off
title YINJIA-MES backend (8090) - KEEP THIS WINDOW OPEN
rem 工作目录必须是仓库根:转ERP凭证兜底按 {工作目录}\deploy\push\config.json 查找
rem (该文件=测试沙箱凭证;真实账套凭证在 deploy\config.json,转ERP 默认拒绝推真实账套,见 KingdeePushService)
cd /d %~dp0..

rem ---- JDK 探测(与 build.bat 同口径:JAVA_HOME → 常见安装目录 → PATH) ----
rem 2026-09-20 修复:原写死 %USERPROFILE%\.jdks\ms-25.0.4\bin\java.exe,本机不存在 → 窗口每 5 秒刷错误
rem 2026-09-22:工具链切到 **JDK 25**(Temurin 25.0.4.1,与 backend/pom.xml 的 java.version=25 对齐);
rem   下面仍保留 26 / jdk-25 等历史路径作兜底(别的机器可能只装了那些)。
set "JAVA_EXE="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
if not defined JAVA_EXE if exist "%USERPROFILE%\.jdks\temurin-25.0.4.1\bin\java.exe" set "JAVA_EXE=%USERPROFILE%\.jdks\temurin-25.0.4.1\bin\java.exe"
if not defined JAVA_EXE if exist "C:\Program Files\Java\jdk-25\bin\java.exe" set "JAVA_EXE=C:\Program Files\Java\jdk-25\bin\java.exe"
if not defined JAVA_EXE if exist "D:\Program Files\Java\jdk-25\bin\java.exe" set "JAVA_EXE=D:\Program Files\Java\jdk-25\bin\java.exe"
if not defined JAVA_EXE if exist "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2\bin\java.exe" set "JAVA_EXE=%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2\bin\java.exe"
if not defined JAVA_EXE if exist "%USERPROFILE%\.jdks\openjdk-26.0.2\bin\java.exe" set "JAVA_EXE=%USERPROFILE%\.jdks\openjdk-26.0.2\bin\java.exe"
if not defined JAVA_EXE set "JAVA_EXE=java"
echo [YINJIA-MES] backend 8090 starting with %JAVA_EXE%

:loop
"%JAVA_EXE%" -jar backend\target\yinjia-mes-backend-0.1.0.jar
echo.
echo Backend exited. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop
