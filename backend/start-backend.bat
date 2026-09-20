@echo off
title YINJIA-MES backend (8090) - KEEP THIS WINDOW OPEN
rem 工作目录必须是仓库根:转ERP凭证兜底按 {工作目录}\deploy\push\config.json 查找
cd /d %~dp0..
:loop
"%USERPROFILE%\.jdks\ms-25.0.4\bin\java.exe" -jar backend\target\yinjia-mes-backend-0.1.0.jar
echo.
echo Backend exited. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop
