@echo off
rem YINJIA-MES service-style start (for Task Scheduler / NSSM; no leftover window)
rem NOTE: this file must stay pure ASCII, and CRLF line endings.
cd /d "%~dp0"
:loop
java -jar app.jar
echo [%date% %time%] process exited, restart in 5s...
timeout /t 5 /nobreak >nul
goto loop
