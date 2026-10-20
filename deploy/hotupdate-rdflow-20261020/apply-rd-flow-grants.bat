@echo off
rem ============================================================================
rem  apply-rd-flow-grants.bat -- OPTIONAL db change for the hot update
rem
rem  Adds the PROJECT_FLOW permission rows (yj_role_panel) + one en translation
rem  row, so NON-admin roles can also see R&D -> Project Management -> Project Flow Control.
rem  It does NOT touch any business data.
rem
rem  Run ON THE SERVER (RDP) as Administrator. Needs sqlcmd + Windows auth (-E).
rem  Log: grants-log.txt next to this .bat
rem ============================================================================
setlocal
cd /d "%~dp0"
set LOG=%~dp0grants-log.txt
set SQL=%~dp0migrate-rd-project-flow-20261020.sql
set SQLCMD=sqlcmd
where sqlcmd >nul 2>&1
if errorlevel 1 set SQLCMD="C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"

if not exist "%SQL%" (
  echo [FAIL] migration sql not found: %SQL%
  exit /b 2
)

echo [grants] %DATE% %TIME% > "%LOG%"
%SQLCMD% -S localhost -E -d HSDZ_MES -f i:65001,o:65001 -b -i "%SQL%" >> "%LOG%" 2>&1
set RC=%ERRORLEVEL%
echo [grants] sqlcmd exit=%RC% >> "%LOG%"
type "%LOG%"
echo.
if "%RC%"=="0" (echo RESULT: OK) else (echo RESULT: FAILED - see grants-log.txt)
exit /b %RC%
