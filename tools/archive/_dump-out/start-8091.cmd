@echo off
rem 历史回填实例(8091)—— 带 -Dmes.hist.backfill=true(放开批号/负结存控制),用于拉取单据的审核+记账回填。
rem 与 8090 同 jar、同库;登录工厂区分账套(YJ=正式 / YJ_TEST=测试)。回填做完可停掉本实例。
cd /d D:\YINJIA-main\backend
"C:\Users\Lenovo\.jdks\temurin-25.0.4.1\bin\java.exe" -Dmes.hist.backfill=true -Dstdout.encoding=UTF-8 -jar "D:\YINJIA-main\backend\target\yinjia-mes-backend-0.1.0.jar" --server.port=8091 >> D:\YINJIA-main\tools\archive\_dump-out\backfill-8091.log 2>&1
