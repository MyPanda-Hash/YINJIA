@echo off
REM ---------------------------------------------------------------------------
REM  YINJIA-MES print agent - one-click diagnostics (2026-11-16)
REM  Double-click this file, wait a few seconds, then send back the txt file
REM  that appears in this folder (with the results). Read-only: it does not
REM  start, stop or configure anything.
REM  Keep this file ASCII-only: cmd.exe reads it in the local ANSI codepage.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
chcp 936 >nul 2>nul
echo.
echo Collecting print-agent status and logs, please wait a few seconds ...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnose.ps1"
echo.
echo Done. The result file is the .txt next to this folder's files.
echo Please send that .txt back to the YINJIA-MES support.
echo.
pause
