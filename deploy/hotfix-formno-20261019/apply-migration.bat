@echo off
rem ============================================================================
rem  apply-migration.bat -- run the formno pool sync migration on the SERVER
rem
rem  Run this ON THE SERVER (RDP) as Administrator. It only touches the DB:
rem    1) removes the blank duplicate document-head rows created by the number
rem       reuse bug (never touches detail lines, never deletes a row that has
rem       any business content);
rem    2) re-registers every existing document number into the s_allno pool.
rem  Safe to run more than once (idempotent). Exit code 0 = self-check passed.
rem
rem  Log: migrate-log.txt next to this .bat
rem ============================================================================
setlocal
cd /d "%~dp0"
set LOG=%~dp0migrate-log.txt
set SQLCMD=sqlcmd
where sqlcmd >nul 2>&1
if errorlevel 1 set SQLCMD="C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"

echo [formno] running migration against HSDZ_MES ...
%SQLCMD% -S localhost -E -d HSDZ_MES -f i:65001,o:65001 -b -i "%~dp0migrate-formno-pool-sync-20261019.sql" > "%LOG%" 2>&1
set RC=%ERRORLEVEL%
echo. >> "%LOG%"
echo [formno] sqlcmd exit=%RC% >> "%LOG%"
type "%LOG%"
echo.
if "%RC%"=="0" (echo RESULT: OK) else (echo RESULT: FAILED - see migrate-log.txt)
exit /b %RC%
