@echo off
rem ============================================================================
rem  apply-update.bat -- HOT UPDATE the MES app.jar on the SERVER (no DB restore)
rem
rem  Run this ON THE SERVER (RDP session) as Administrator.
rem  What it does:
rem    1) copies the new app.jar from the redirected dev drive (\\tsclient\C\...)
rem    2) backs up the server jar that is currently in C:\yinjia\update\app.jar
rem    3) runs C:\yinjia\update.bat (stop -> swap -> start)
rem    4) probes http://127.0.0.1:8090/ and prints RESULT: OK / FAILED
rem  It does NOT touch the database.
rem
rem  Log: apply-update-log.txt next to this .bat (i.e. on the dev machine,
rem       through the redirected drive -- read it there, do not trust screenshots)
rem ============================================================================
setlocal
cd /d "%~dp0"
set LOG=%~dp0apply-update-log.txt
set SRC=%~dp0app.jar
set DEST=C:\yinjia\update\app.jar

echo [MES hot update] %DATE% %TIME% > "%LOG%"
echo [src ] %SRC% >> "%LOG%"

if not exist "%SRC%" (
  echo [FAIL] app.jar not found next to this bat: %SRC% >> "%LOG%"
  type "%LOG%"
  echo RESULT: FAILED - app.jar missing
  exit /b 2
)
if not exist "C:\yinjia\update.bat" (
  echo [FAIL] C:\yinjia\update.bat not found -- server layout changed, do it manually >> "%LOG%"
  type "%LOG%"
  echo RESULT: FAILED - update.bat missing
  exit /b 3
)
if not exist "C:\yinjia\update" mkdir "C:\yinjia\update"

rem ---- 1) backup the jar currently staged on the server ----
if exist "%DEST%" (
  copy /Y "%DEST%" "%DEST%.bak-before-rdflow" >> "%LOG%" 2>&1
  echo [backup] %DEST%.bak-before-rdflow >> "%LOG%"
)

rem ---- 2) stage the new jar ----
copy /Y "%SRC%" "%DEST%" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [FAIL] copy app.jar failed >> "%LOG%"
  type "%LOG%"
  echo RESULT: FAILED - copy failed
  exit /b 4
)
for %%A in ("%SRC%")  do set SRC_SIZE=%%~zA
for %%A in ("%DEST%") do set DST_SIZE=%%~zA
echo [size] src=%SRC_SIZE% dest=%DST_SIZE% >> "%LOG%"
if not "%SRC_SIZE%"=="%DST_SIZE%" (
  echo [FAIL] size mismatch after copy >> "%LOG%"
  type "%LOG%"
  echo RESULT: FAILED - size mismatch
  exit /b 5
)

rem ---- 3) stop / swap / start ----
call "C:\yinjia\update.bat" >> "%LOG%" 2>&1
echo [update.bat] exit=%ERRORLEVEL% >> "%LOG%"

rem ---- 4) health probe (give Tomcat a moment) ----
timeout /t 40 /nobreak >nul
set CODE=
for /f "delims=" %%C in ('curl -s -o NUL -w "%%{http_code}" http://127.0.0.1:8090/ 2^>nul') do set CODE=%%C
echo [health] http code = %CODE% >> "%LOG%"

echo. >> "%LOG%"
type "%LOG%"
echo.
if "%CODE%"=="200" (
  echo RESULT: OK
  exit /b 0
) else (
  echo RESULT: FAILED - app not answering, see apply-update-log.txt
  exit /b 6
)
