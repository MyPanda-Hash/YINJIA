@echo off
rem YINJIA-MES start script (foreground window; closing the window stops the app)
rem NOTE: this file must stay pure ASCII - a bat with Chinese text in UTF-8 breaks in a zh-CN cmd.
rem (that is why the reference to the deploy handbook below is in English only)
cd /d "%~dp0"

rem Production hardening: uncomment the next line and put a 64-hex-char secret.
rem Generate locally with:
rem   -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
rem set YINJIA_JWT_SECRET=CHANGE_ME_64_HEX_CHARS

title YINJIA-MES backend :8090
java -jar app.jar
pause
