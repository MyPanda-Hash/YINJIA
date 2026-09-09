@echo off
rem jdy-sync-setup.bat - Install jdy-sync scheduled task on server (run as Administrator)
rem Prerequisite: Node.js LTS installed, jdy-sync extracted to D:\jdy-sync

if not exist "D:\jdy-sync\sync.mjs" (
  echo [ERROR] D:\jdy-sync\sync.mjs not found. Extract jdy-sync.zip to D:\ first.
  pause
  exit /b 1
)

echo Creating scheduled task: jdy-sync (every 5 minutes)...
schtasks /Create /TN "jdy-sync" /TR "node D:\jdy-sync\sync.mjs" /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /F

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to create scheduled task.
  pause
  exit /b 1
)

echo.
echo [OK] Scheduled task created.
echo Running first sync now...
node D:\jdy-sync\sync.mjs

echo.
echo ===== jdy-sync deployment complete =====
echo Task runs every 5 minutes as SYSTEM.
echo Check sync log: type D:\jdy-sync\sync.log
echo Test manually:  node D:\jdy-sync\sync.mjs
pause
