@echo off
rem YINJIA-MES 启动脚本(前台窗口运行,关窗即停)
cd /d "%~dp0"

rem 生产加固:取消下一行注释并填入 64 位随机十六进制串(本地生成见部署说明 五.2)
rem set YINJIA_JWT_SECRET=CHANGE_ME_64_HEX_CHARS

title YINJIA-MES backend :8090
java -jar app.jar
pause
