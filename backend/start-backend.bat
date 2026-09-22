@echo off
title YINJIA-MES backend (8090) - KEEP THIS WINDOW OPEN
rem Working dir must be repo root: ERP push credential fallback looks up {cwd}\deploy\push\config.json
cd /d %~dp0..
:loop
"%USERPROFILE%\.jdks\ms-25.0.4\bin\java.exe" -jar backend\target\yinjia-mes-backend-0.1.0.jar
echo.
echo Backend exited. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop
