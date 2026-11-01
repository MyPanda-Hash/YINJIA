@echo off
rem ============================================================================
rem  apply-db.bat  --  make WO_COMPLETION_LIST show the newest completion on top
rem
rem  What it does (one row of metadata, nothing else):
rem    1) preflight : print panel rows + current date_col (expected NULL)
rem    2) apply     : run migrate-wo-completion-sort-20261021.sql (idempotent)
rem    3) verify    : date_col=wgsj, out_of_order_pairs=0, top rows newest first
rem
rem  No DB backup and no service stop:
rem    the only change is yj_panel.date_col for one flat panel (NULL -> wgsj).
rem    Business data, the view, yj_field and permissions are not touched.
rem    Rollback is one SQL line (printed at the end of this run).
rem
rem  Usage (cmd on the server; admin is NOT required for this package):
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
set SQLFILE=%HERE%migrate-wo-completion-sort-20261021.sql
set CHECKFILE=%HERE%check-sort.sql

echo ============================================================
echo  target database : %DB%
echo  fix script      : %SQLFILE%
echo ============================================================

if not exist "%SQLFILE%" (
  echo [FAIL] script not found: %SQLFILE%
  exit /b 1
)
if not exist "%CHECKFILE%" (
  echo [FAIL] check script not found: %CHECKFILE%
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
  echo [FAIL] sqlcmd not found. Run the two .sql files from SSMS instead.
  echo        See README section 4.
  exit /b 1
)
echo  sqlcmd          : !SQLCMD!

rem ---- 1) preflight ----------------------------------------------------------
echo.
echo [1/3] preflight (read-only)
"!SQLCMD!" -S localhost -d %DB% -E -b -W -s "|" -f 65001 -Q "SET NOCOUNT ON; SELECT N'panel_rows' AS k, COUNT(*) AS v FROM dbo.yj_panel WHERE panel_code=N'WO_COMPLETION_LIST'; SELECT N'date_col_before' AS k, ISNULL(date_col,N'(NULL)') AS v FROM dbo.yj_panel WHERE panel_code=N'WO_COMPLETION_LIST';"
if errorlevel 1 (
  echo [FAIL] cannot read dbo.yj_panel in %DB% - check database name / permissions.
  exit /b 1
)

rem ---- 2) apply --------------------------------------------------------------
echo.
echo [2/3] apply the sort metadata (single-row update, idempotent)
"!SQLCMD!" -S localhost -d %DB% -E -b -f 65001 -i "%SQLFILE%"
if errorlevel 1 (
  echo [FAIL] script failed - transaction rolled back, nothing was changed.
  echo        See README section 3.3.
  exit /b 1
)
echo       script ok.

rem ---- 3) verify -------------------------------------------------------------
echo.
echo [3/3] verify (date_col must be wgsj; out_of_order_pairs must be 0)
"!SQLCMD!" -S localhost -d %DB% -E -b -W -s "|" -f 65001 -i "%CHECKFILE%"
if errorlevel 1 (
  echo [FAIL] verification failed - read the lines above. See README section 3.3.
  exit /b 1
)

echo.
echo ============================================================
echo  RESULT: DONE for %DB%
echo  - panel order is now: wgsj DESC, id DESC  (newest completion on top)
echo  - wait about 30 seconds (metadata cache), then refresh the page
echo  - rollback (only if ever needed):
echo      sqlcmd -S localhost -d %DB% -E -Q "UPDATE dbo.yj_panel SET date_col=NULL WHERE panel_code='WO_COMPLETION_LIST'"
echo ============================================================
endlocal
