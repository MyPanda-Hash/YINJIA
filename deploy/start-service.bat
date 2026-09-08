@echo off
rem YINJIA-MES 服务式启动(供任务计划程序/NSSM调用,无窗口残留)
cd /d "%~dp0"
:loop
java -jar app.jar
echo [%date% %time%] 进程退出,5 秒后自动重启...
timeout /t 5 /nobreak >nul
goto loop
