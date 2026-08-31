@echo off
chcp 65001 >nul
rem YINJIA-MES 一键启动:后端(8090) + 前端 dev(5173)
setlocal

set "JAVA_HOME=D:\Program Files\Java\jdk-24"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [错误] 未找到 JDK: %JAVA_HOME%
  goto :fail
)

if not exist "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar" (
  echo [提示] 后端未构建,先执行 backend\build.bat
  goto :fail
)

echo [1/2] 启动后端 http://localhost:8090 ...
start "YINJIA-MES backend" cmd /c ""%JAVA_HOME%\bin\java.exe" -jar "%~dp0backend\target\yinjia-mes-backend-0.1.0.jar""

timeout /t 5 /nobreak >nul

echo [2/2] 启动前端 http://localhost:5173 ...
cd /d "%~dp0frontend"
start "YINJIA-MES frontend" cmd /c "npm run dev"

echo.
echo 完成:浏览器访问 http://localhost:5173  (admin / 123456)
goto :eof

:fail
pause
exit /b 1
