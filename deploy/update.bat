@echo off
rem update.bat - YINJIA-MES hot update: swap update app.jar in and restart (database untouched)
cd /d "%~dp0"
if not exist "update\app.jar" (
  echo [ERROR] C:\yinjia\update\app.jar not found. Put the new app.jar there first.
  pause
  exit /b 1
)
echo [1/4] stopping backend...
taskkill /IM java.exe /F >nul 2>&1
timeout /t 3 /nobreak >nul
echo [2/4] backing up current jar to app.jar.bak ...
copy /Y app.jar app.jar.bak >nul
echo [3/4] installing new jar...
copy /Y "update\app.jar" app.jar >nul
del /Q "update\app.jar" >nul
echo [4/4] starting backend...
start "" cmd /c "C:\yinjia\start.bat"
echo.
echo [DONE] hot update finished. Watch new window for "Started MesApplication".
echo Rollback: copy /Y C:\yinjia\app.jar.bak C:\yinjia\app.jar  + restart
pause
