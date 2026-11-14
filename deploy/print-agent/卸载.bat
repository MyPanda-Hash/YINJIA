echo off
chcp 936 >nul
title 银嘉MES 打印代理 - 卸载
cd /d "%~dp0"

echo.
echo ============================================
echo   银嘉 MES . 打印代理 卸载
echo ============================================
echo.

if not exist "卸载.ps1" (
  echo [FAIL] 同目录下找不到 卸载.ps1
  echo        请把整个文件夹一起拷贝过来。
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0卸载.ps1"

echo.
echo 这个窗口可以关掉了。
echo.
pause
