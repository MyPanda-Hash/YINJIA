@echo off
cd /d D:\YINJIA-main
"C:\Program Files\nodejs\node.exe" tools\archive\_audit-synced-and-convert-1014.mjs --from 2026-09-01 > "D:\YINJIA-main\tools\archive\_dump-out\audit-convert-1014.log" 2>&1
echo DONE >> "D:\YINJIA-main\tools\archive\_dump-out\audit-convert-1014.log"
