@echo off
rem 正式实例(8090)—— 用户日常使用,不带回填开关(库存控制按日常口径)。
cd /d D:\YINJIA-main\backend
"C:\Users\Lenovo\.jdks\temurin-25.0.4.1\bin\java.exe" -Dstdout.encoding=UTF-8 -jar "D:\YINJIA-main\backend\target\yinjia-mes-backend-0.1.0.jar" --server.port=8090 >> D:\YINJIA-main\backend-out.log 2>&1
