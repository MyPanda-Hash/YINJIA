@echo off
rem 历史回填实例(2026-10-14):带 -Dmes.hist.backfill=true,端口 8091,不动 8090。
rem 用类路径启动(target\classes + 依赖),因为 backend\target 下的 jar 被 8090 占用无法重打包。
set JAVA=C:\Users\Lenovo\.jdks\temurin-25.0.4.1\bin\java.exe
set CP=D:\YINJIA-main\backend\target\classes
for /f "usebackq delims=" %%i in ("D:\YINJIA-main\backend\target\cp.txt") do set CP=%CP%;%%i
cd /d D:\YINJIA-main\backend
"%JAVA%" -Dmes.hist.backfill=true -Dstdout.encoding=UTF-8 -cp "%CP%" com.yinjia.mes.MesApplication --server.port=8091 >> D:\YINJIA-main\tools\archive\_dump-out\backfill-8091.log 2>&1
