@echo off
chcp 65001 >nul
rem YINJIA-MES one-click start: backend (8090) + frontend dev (5173)
setlocal

rem ---- JDK detection (same as build.bat) ----
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
for %%D in ("C:\Program Files\Java\jdk-25" "D:\Program Files\Java\jdk-25" "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul || ( echo [ERROR] JDK 25 not found & goto :fail )
:jdk_ok

if not exist "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar" (
  echo [HINT] backend not built yet; run backend\build.bat first
  goto :fail
)

rem ---- Aliyun keys: backend\.env (local, not in git); missing => MT/OCR degrade gracefully ----
if exist "%~dp0backend\.env" for /f "usebackq delims=" %%L in ("%~dp0backend\.env") do set "%%L"

echo [1/2] starting backend  http://localhost:8090 ...
start "YINJIA-MES backend" cmd /c ""%JAVA_HOME%\bin\java.exe" -jar "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar""

timeout /t 5 /nobreak >nul

echo [2/2] starting frontend http://localhost:5173 ...
cd /d "%~dp0frontend"
start "YINJIA-MES frontend" cmd /c "npm run dev"

echo.
echo Done: open http://localhost:5173  (admin / 123456)
goto :eof

:fail
pause
exit /b 1
