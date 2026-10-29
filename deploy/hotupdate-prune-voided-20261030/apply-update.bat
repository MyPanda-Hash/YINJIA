@echo off
rem ============================================================================
rem  apply-update.bat -- HOT UPDATE the MES app.jar on the SERVER (jar only)
rem
rem  Run this ON THE SERVER (RDP) as Administrator.
rem  Package: hotupdate-prune-voided-20261030
rem  Fix: voided/deleted RD docs must vanish from "project flow control"
rem       and "project progress query".
rem  What it does:
rem    1) size-gates the new app.jar (must be ~93 MB, never a truncated copy)
rem    2) backs up the jar currently staged on the server (.bak-before-prune)
rem    3) copies the new jar to C:\yinjia\update
rem    4) runs C:\yinjia\update.bat (stop -> swap -> start)
rem    5) probes http://127.0.0.1:8090/ and prints RESULT: OK / FAILED
rem  It does NOT touch the database. No SQL to run.
rem
rem  Works when launched straight from the redirected drive (\\tsclient\C\...):
rem  pushd maps a temp drive letter instead of failing like "cd /d" does on UNC.
rem
rem  Log: apply-update-log.txt next to this .bat (i.e. on the dev machine,
rem       through the redirected drive -- read it there, do not trust screenshots)
rem ============================================================================
setlocal
pushd "%~dp0" 2>nul
if errorlevel 1 cd /d "%TEMP%"
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

rem --- size gate: never let a truncated / placeholder jar overwrite a working one ---
for %%A in ("%SRC%") do set SRC_SIZE0=%%~zA
echo [size] src=%SRC_SIZE0% bytes >> "%LOG%"
if %SRC_SIZE0% LSS 80000000 (
  echo [FAIL] app.jar looks truncated ^(expected ~107000000 bytes^) >> "%LOG%"
  type "%LOG%"
  echo RESULT: FAILED - app.jar truncated
  exit /b 7
)

if not exist "C:\yinjia\update" mkdir "C:\yinjia\update"

if exist "%DEST%" (
  copy /Y "%DEST%" "%DEST%.bak-before-prune" >> "%LOG%" 2>&1
  echo [backup] %DEST%.bak-before-prune >> "%LOG%"
)

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

call "C:\yinjia\update.bat" >> "%LOG%" 2>&1
echo [update.bat] exit=%ERRORLEVEL% >> "%LOG%"

timeout /t 40 /nobreak >nul
set CODE=
for /f "delims=" %%C in ('curl -s -o NUL -w "%%{http_code}" http://127.0.0.1:8090/ 2^>nul') do set CODE=%%C
echo [health] http code = %CODE% >> "%LOG%"

echo. >> "%LOG%"
type "%LOG%"
echo.
popd 2>nul
if "%CODE%"=="200" (
  echo RESULT: OK
  exit /b 0
) else (
  echo RESULT: FAILED - app not answering, see apply-update-log.txt
  exit /b 6
)
