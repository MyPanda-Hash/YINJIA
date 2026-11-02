@echo off
chcp 65001 >nul
title 银嘉MES 打印代理 - 安装
cd /d "%~dp0"

echo.
echo ============================================
echo   银嘉 MES . 打印代理 安装
echo ============================================
echo.

if not exist "print-agent.ps1" (
  echo [FAIL] 同目录下找不到 print-agent.ps1
  echo        请把整个文件夹一起拷贝过来，不要只拷一个文件。
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装.ps1"
if errorlevel 1 (
  echo.
  echo [FAIL] 安装过程中出错，请把上面红色文字截图给管理员。
  echo.
  pause
  exit /b 1
)

echo.
echo 安装完成。这个窗口可以关掉。
echo.
pause
