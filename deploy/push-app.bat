@echo off
rem ==================================================================
rem  push-app.bat - stage the new app.jar and hot-update (server side)
rem ------------------------------------------------------------------
rem  PURE ASCII ON PURPOSE (zh-CN cmd reads bat as GBK).
rem  Run it from the RDP session as:  \\tsclient\C\yj-deploy\push-app.bat
rem  It copies %~dp0app.jar in, then does the 4 steps of update.bat
rem  inline (minus the pause), then health-checks :8090.
rem  Rollback:  copy /Y C:\yinjia\app.jar.bak C:\yinjia\app.jar  + restart
rem ==================================================================
setlocal enabledelayedexpansion

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=C:\yinjia"
set "TOOLS=%SRC%\db-tools"
if defined YJ_DEST set "DEST=%YJ_DEST%"

set "LOGDIR=%SRC%\logs"
mkdir "%LOGDIR%" 2>nul
set "TS=manual"
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss" 2^>nul') do set "TS=%%i"
set "LOG=%LOGDIR%\push-app-%TS%.log"

> "%LOG%" echo push-app %TS%
>>"%LOG%" echo host : %COMPUTERNAME%  src: %SRC%
>>"%LOG%" echo --------------------------------------------------------------

echo.
echo ==================================================================
echo   YINJIA-MES push-app    src=%SRC%
echo ==================================================================

echo [1/5] staging new jar ...
if not exist "%SRC%\app.jar" goto :nojar
mkdir "%DEST%\update" 2>nul
copy /Y "%SRC%\app.jar" "%DEST%\update\app.jar" >>"%LOG%" 2>&1
if errorlevel 1 goto :nocopy
for %%f in ("%SRC%\app.jar") do echo      staged %%~zf bytes
rem DO NOT hash %SRC% here: it lives on the RDP redirected drive, and a server-side
rem process reading 50MB+ through that redirect is so slow it looks like a hang
rem (measured twice on 2026-09-10). Verify the SHA256 on the DEVELOPER machine.

echo [2/5] stopping backend ...
taskkill /IM java.exe /F >>"%LOG%" 2>&1
ping -n 5 127.0.0.1 >nul

echo [3/5] swapping jar (old one kept as app.jar.bak) ...
copy /Y "%DEST%\app.jar" "%DEST%\app.jar.bak" >>"%LOG%" 2>&1
copy /Y "%DEST%\update\app.jar" "%DEST%\app.jar" >>"%LOG%" 2>&1
del /Q "%DEST%\update\app.jar" 2>nul
>>"%LOG%" echo [ok] swapped

echo [3b/5] cleaning stale doc-status rows (orphans make new docs look archived) ...
if exist "%TOOLS%\migrate-clean-orphan-docstatus.sql" (
  sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i "%TOOLS%\migrate-clean-orphan-docstatus.sql" >>"%LOG%" 2>&1
  echo   orphan cleanup exit=!errorlevel!
) else (
  echo   [WARN] migrate-clean-orphan-docstatus.sql not found, skipped
)

echo [4/5] starting backend ...
start "" cmd /c "%DEST%\start.bat"

echo [5/5] waiting for :8090 ...
set "UP=0"
for /l %%i in (1,1,12) do (
  ping -n 4 127.0.0.1 >nul
  for /f "delims=" %%h in ('powershell -NoProfile -Command "try{(Invoke-WebRequest http://127.0.0.1:8090/ -UseBasicParsing -TimeoutSec 6).StatusCode}catch{0}" 2^>nul') do set "HS=%%h"
  echo   try %%i : !HS!
  if "!HS!"=="200" if "!UP!"=="0" ( set "UP=1" & >>"%LOG%" echo [ok] backend up on try %%i )
)
if "!UP!"=="1" (echo   RESULT: backend UP) else (echo   RESULT: backend NOT UP - check the java window)
>>"%LOG%" echo RESULT: up=!UP!
>>"%LOG%" echo --------------------------------------------------------------
copy /Y "%LOG%" "%LOGDIR%\push-app-last.log" >nul 2>&1
echo.
echo   Full log: %LOG%
echo   Rollback: copy /Y %DEST%\app.jar.bak %DEST%\app.jar   then restart
endlocal
exit /b 0

:nojar
echo [FATAL] %SRC%\app.jar not found
>>"%LOG%" echo [FATAL] app.jar not found
endlocal
exit /b 1

:nocopy
echo [FATAL] could not copy the jar (see log)
>>"%LOG%" echo [FATAL] copy failed
endlocal
exit /b 1
