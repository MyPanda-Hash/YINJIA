@echo off
rem ============================================================================
rem  apply-db-optional.bat -- OPTIONAL, run only if you accept small DB changes
rem
rem  Runs two idempotent migrations on HSDZ_MES (sqlcmd -E, Windows auth):
rem    1) migrate-dc-config-rename-20261020.sql
rem       renames the DC config panel translation key to "IOT device config" (+ en text).
rem       Without it the page itself still shows the new name (it comes from code);
rem       only the permission-matrix / DB-side panel name stays on the old key.
rem    2) migrate-rd-project-flow-20261020.sql
rem       adds PROJECT_FLOW permission rows for existing roles + one en translation,
rem       so NON-admin roles can open RND -> Project Management -> Project Flow Control.
rem       Skip this if the server's roles differ from the dev box (user said so).
rem
rem  No business data is touched. Log: db-optional-log.txt next to this .bat
rem ============================================================================
setlocal
cd /d "%~dp0"
set LOG=%~dp0db-optional-log.txt
set SQLCMD=sqlcmd
where sqlcmd >nul 2>&1
if errorlevel 1 set SQLCMD="C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"

echo [optional db] %DATE% %TIME% > "%LOG%"
for %%F in (migrate-dc-config-rename-20261020.sql migrate-rd-project-flow-20261020.sql) do (
  echo == %%F == >> "%LOG%"
  %SQLCMD% -S localhost -E -d HSDZ_MES -f i:65001,o:65001 -b -i "%~dp0%%F" >> "%LOG%" 2>&1
  echo [rc] %%F = %ERRORLEVEL% >> "%LOG%"
)
type "%LOG%"
echo.
echo RESULT: see db-optional-log.txt
