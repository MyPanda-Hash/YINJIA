@echo off
rem _live-dc-scan.bat — 验收当天一键开「扫码枪」实时演示数据(每 10 秒一次扫码)
rem 前提:8090 已在跑(tools\scripts\start-prod.ps1);关掉这个窗口就停止上报。
chcp 65001 >nul
cd /d "%~dp0..\..\.."
echo === 数采平台 · 扫码枪 FX-001 实时演示 ===
echo 页面:http://127.0.0.1:8090/#/dc/monitor  (选「扫码枪」)
echo 停止:直接关掉本窗口,或 Ctrl+C
node "tools\archive\_dc-scan-demo-20261018\_seed-dc-scan-demo.cjs" --live
pause
