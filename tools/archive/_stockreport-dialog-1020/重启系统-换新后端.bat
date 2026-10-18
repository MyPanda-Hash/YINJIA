@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\..\..\.."
echo ============================================================
echo  Restart YINJIA-MES (prod instance 8090) with the NEW backend class
echo  8090 currently runs the OLD jar (sandbox cannot kill it);
echo  only your own desktop session has the permission.
echo ============================================================
echo.

echo [1/5] stop prod instance ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\scripts\start-prod.ps1" -Stop

echo.
echo [2/5] wait for jar handle release (max 60s) ...
powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){ try{ $f=[IO.File]::Open('backend\target\yinjia-mes-backend-0.1.0.jar','Open','ReadWrite','None'); $f.Close(); exit 0 }catch{ Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 goto :jar_locked

echo.
echo [3/5] swap jar: build.jar to yinjia-mes-backend-0.1.0.jar (old kept as .jar.orig1020)
powershell -NoProfile -Command "Set-Location 'backend\target'; if (Test-Path 'yinjia-mes-backend-0.1.0.jar.orig1020') { Remove-Item 'yinjia-mes-backend-0.1.0.jar.orig1020' -Force }; Move-Item 'yinjia-mes-backend-0.1.0.jar' 'yinjia-mes-backend-0.1.0.jar.orig1020' -Force; Move-Item 'yinjia-mes-backend-0.1.0.build.jar' 'yinjia-mes-backend-0.1.0.jar' -Force; Write-Host ('      new jar bytes: ' + (Get-Item 'yinjia-mes-backend-0.1.0.jar').Length)"
if errorlevel 1 goto :swap_failed

echo.
echo [4/5] start prod instance ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\scripts\start-prod.ps1"

echo.
echo [5/5] waiting 25s, then running API regression ...
timeout /t 25 /nobreak >nul
node "tools\archive\_stockreport-dialog-1020\_v-gate.mjs"

echo.
echo ============================================================
echo  Done. Open http://127.0.0.1:8090
echo   - Stock Ledger / In-Out-Balance Summary: query dialog opens ONCE;
echo     closing it does not pop back.
echo   - "Active" line shows conditions currently in effect;
echo     date range defaults to this month 1st .. today.
echo   - Stock Ledger shows detail rows after picking warehouse + item
echo     (no longer just opening/closing synthetic rows).
echo ============================================================
pause
exit /b 0

:jar_locked
echo      [FAIL] jar still locked after 60s.
echo      If 8090 still responds, end its process in Task Manager and run again.
goto :halt

:swap_failed
echo      [FAIL] jar swap failed; old jar is at
echo      backend\target\yinjia-mes-backend-0.1.0.jar.orig1020 (rename back if needed).
goto :halt

:halt
echo.
pause
exit /b 1
