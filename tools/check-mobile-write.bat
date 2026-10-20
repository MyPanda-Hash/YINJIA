@echo off
REM ============================================================
REM  check-mobile-write.bat - read-only health check for mobile-side writes
REM  (run ON THE SERVER, where SQL Server listens on localhost:1433)
REM
REM  usage:  check-mobile-write.bat            -> HSDZ_MES
REM          check-mobile-write.bat HSDZ_MES_TEST
REM
REM  what it prints:
REM    1) close-anomaly rows (the red tags)
REM    2) work-order rows created in the last 48h (who created / dirty values)
REM    3) report rows (scjl) written in the last 48h (external-write fingerprints)
REM    4) unclosed / unfinished work-order rows
REM    5) number pool vs work orders
REM    6) duplicate (pl_no + line no)
REM    7) one-line summary
REM ============================================================
setlocal
set DB=%1
if "%DB%"=="" set DB=HSDZ_MES
set SQLFILE=%~dp0check-mobile-write-20261020.sql

if not exist "%SQLFILE%" (
  echo [ERROR] SQL file not found: %SQLFILE%
  exit /b 2
)

where sqlcmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] sqlcmd not found. Use the full path, e.g.:
  echo   "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE" -S localhost -E -d %DB% -i "%SQLFILE%"
  exit /b 3
)

echo === checking %DB% ^(read-only^) ===
sqlcmd -S localhost -E -d %DB% -i "%SQLFILE%" -W -s " | "
if errorlevel 1 (
  echo [ERROR] sqlcmd failed. If "Login failed", try -U sa -P ^<password^> instead of -E.
  exit /b 4
)
endlocal
