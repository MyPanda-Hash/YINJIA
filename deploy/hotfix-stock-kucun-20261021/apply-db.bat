@echo off
rem ============================================================================
rem  apply-db.bat  --  fix "stock detail empty / goods invisible" on the SERVER
rem
rem  What it does:
rem    1) BACKUP DATABASE to C:\yinjia\backup\pre-kucun-recalc-<ts>.bak
rem    2) run migrate-kucun-recalc-today-20261021.sql (idempotent, no DELETE)
rem    3) print the self-check numbers (items 1/2/3 must be 0)
rem
rem  Usage (admin cmd):
rem    apply-db.bat                 -> HSDZ_MES
rem    apply-db.bat HSDZ_MES_TEST   -> test ledger
rem
rem  NOTE: keep this file PURE ASCII + CRLF. A UTF-8 bat with Chinese text is
rem        known to be shredded by cmd.exe on a fresh machine.
rem ============================================================================
setlocal enabledelayedexpansion

set DB=%~1
if "%DB%"=="" set DB=HSDZ_MES
set HERE=%~dp0
set SQLFILE=%HERE%migrate-kucun-recalc-today-20261021.sql
set BAKDIR=C:\yinjia\backup

echo ============================================================
echo  target database : %DB%
echo  sql file        : %SQLFILE%
echo ============================================================

if not exist "%SQLFILE%" (
  echo [FAIL] sql file not found: %SQLFILE%
  exit /b 1
)

rem ---- locate sqlcmd ---------------------------------------------------------
set SQLCMD=
for /f "delims=" %%i in ('where sqlcmd 2^>nul') do if not defined SQLCMD set "SQLCMD=%%i"
if not defined SQLCMD (
  for %%p in (
    "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe"
    "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\sqlcmd.exe"
    "C:\Program Files\Microsoft SQL Server\150\Tools\Binn\sqlcmd.exe"
  ) do if not defined SQLCMD if exist %%p set "SQLCMD=%%p"
)
if not defined SQLCMD (
  echo [FAIL] sqlcmd not found. Install SQL Server command line tools, or run the
  echo        script from SSMS instead. See README section 4-B.
  exit /b 1
)
echo  sqlcmd          : !SQLCMD!

rem ---- timestamp ------------------------------------------------------------
set TS=
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
if not defined TS set "TS=manual"

rem ---- 1) backup -------------------------------------------------------------
if not exist "%BAKDIR%" mkdir "%BAKDIR%"
set BAKFILE=%BAKDIR%\pre-kucun-recalc-%TS%.bak
echo.
echo [1/3] backup database -^> %BAKFILE%
"!SQLCMD!" -S localhost -E -b -Q "BACKUP DATABASE [%DB%] TO DISK = N'%BAKFILE%' WITH FORMAT, INIT, COMPRESSION, CHECKSUM"
if errorlevel 1 (
  echo [FAIL] backup failed - STOP here, do NOT run the script.
  exit /b 1
)
echo       backup ok.

rem ---- 2) run the fix --------------------------------------------------------
echo.
echo [2/3] run the fix script (this is the actual repair)
"!SQLCMD!" -S localhost -d %DB% -E -b -f 65001 -i "%SQLFILE%"
if errorlevel 1 (
  echo [FAIL] script failed. Database was NOT modified beyond the failed batch.
  echo        Restore from %BAKFILE% if you need to roll back. See README.
  exit /b 1
)
echo       script ok.

rem ---- 3) verify -------------------------------------------------------------
echo.
echo [3/3] self-check (item 1/2/3 must be 0)
"!SQLCMD!" -S localhost -d %DB% -E -b -W -s "|" -Q "SET NOCOUNT ON; SELECT N'kucun_rows' AS k, COUNT(*) AS v FROM dbo.kucun UNION ALL SELECT N'sum_yl', CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM dbo.kucun UNION ALL SELECT N'zero_rows', SUM(CASE WHEN yl=0 THEN 1 ELSE 0 END) FROM dbo.kucun UNION ALL SELECT N'seed_item_YJ-YCYX-055', CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM dbo.kucun WHERE wzdm=N'YJ-YCYX-055';"

echo.
echo ============================================================
echo  RESULT: DONE for %DB%
echo  - check that the numbers above are sane
echo  - backup kept at: %BAKFILE%
echo  - then open http://localhost:8090  -  stock detail (stock_detail panel)
echo ============================================================
endlocal
