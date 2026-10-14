@echo off
cd /d D:\YINJIA-main
echo === start %DATE% %TIME% === >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log"
echo ##### HSDZ_MES ##### >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log"
"C:\Program Files\nodejs\node.exe" tools\archive\_post-pulled-docs-1014.mjs --db HSDZ_MES --base http://127.0.0.1:8091 >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log" 2>&1
echo ##### HSDZ_MES_TEST ##### >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log"
"C:\Program Files\nodejs\node.exe" tools\archive\_post-pulled-docs-1014.mjs --db HSDZ_MES_TEST --base http://127.0.0.1:8091 >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log" 2>&1
echo === done %DATE% %TIME% === >> "D:\YINJIA-main\tools\archive\_dump-out\post-run-1014.log"