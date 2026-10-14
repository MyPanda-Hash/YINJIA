@echo off
cd /d D:\YINJIA-main
"C:\Program Files\nodejs\node.exe" tools\archive\_flow-po-to-receipt-1014.mjs --db HSDZ_MES --from 2026-09-14 > "D:\YINJIA-main\tools\archive\_dump-out\po-flow-1014.log" 2>&1
echo DONE >> "D:\YINJIA-main\tools\archive\_dump-out\po-flow-1014.log"
