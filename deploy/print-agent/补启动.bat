@echo off
REM ---------------------------------------------------------------------------
REM  YINJIA-MES print agent - one-click "repair / start" (2026-11-16)
REM
REM  Double-click this file when the printer disappeared from the MES panel:
REM    - starts the agent if it is not running;
REM    - restores the autostart entry and the 1-minute watchdog task if missing;
REM    - prints the status (health / poll / heartbeat / station online).
REM  It never asks for the server address or password: it reuses the existing
REM  print-agent.config.json (or the existing Run entry).
REM
REM  You can also pass -Restart to force a restart, e.g. from cmd:
REM    start-agent.ps1 -Restart   (or: this bat file with -Restart)
REM
REM  Keep this file ASCII-only: cmd.exe reads it in the local ANSI codepage.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
chcp 936 >nul 2>nul
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-agent.ps1" %*
echo.
pause
