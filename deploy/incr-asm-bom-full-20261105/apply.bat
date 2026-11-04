@echo off
setlocal EnableExtensions
REM ===========================================================================
REM  ASM_BOM (Assembly BOM) FULL data import - one-time package, 2026-11-05
REM  Source : Kingdee BOM export (xlsx sheet ListData), 3641 data rows / 73 cols
REM  Target : HSDZ_MES on this machine (local SQL Server instance)
REM  Scope  : 827 BOM docs / 817 products / 3640 component rows
REM  Effects: only DELETE+INSERT rows carrying the Kingdee-BOM-export source tag;
REM           panel-created BOM docs are NOT touched; no DDL at all.
REM  Usage  : run as Administrator on the application server:
REM             apply.bat  -> backup + migrate + verify (RESULT: ALL-OK)
REM  ASCII-only on purpose: cmd.exe garbles UTF-8 Chinese in .bat on some hosts.
REM ===========================================================================
cd /d "%~dp0"
set "PKG=%~dp0"
if "%PKG:~-1%"=="\" set "PKG=%PKG:~0,-1%"
if not exist "%PKG%\logs" mkdir "%PKG%\logs"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=%PKG%\logs\apply-%TS%.log"
set "INSTALL=C:\yinjia"
set "BAKDIR=%INSTALL%\backup"
set "SCRIPT=migrate-asm-bom-data-full-20261105.sql"

echo === ASM-BOM full import %DATE% %TIME% === >> "%LOG%"
chcp 65001 >nul

echo [1] preflight ...
where java >nul 2>nul
if errorlevel 1 goto fail-java
where sqlcmd >nul 2>nul
if errorlevel 1 goto fail-sqlcmd
if not exist "%PKG%\%SCRIPT%" goto fail-file
if not exist "%PKG%\tools\DbSync.java" goto fail-file
if not exist "%PKG%\tools\lib\mssql-jdbc.jar" goto fail-file
if not exist "%PKG%\tools\db-migrations.txt" goto fail-file
if not exist "%PKG%\CHECK-after.sql" goto fail-file
call sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'DB=' + DB_NAME() + ' TABLE=' + CASE WHEN OBJECT_ID('dbo.bs_asm_bom') IS NULL THEN '0' ELSE '1' END + ' CURROWS=' + CAST(ISNULL((SELECT COUNT(*) FROM dbo.bs_asm_bom),0) AS varchar(20)) + ' SYSADMIN=' + CAST(IS_SRVROLEMEMBER('sysadmin') AS varchar(1))" -o "%PKG%\logs\check-before-%TS%.txt" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-sqlcmd
type "%PKG%\logs\check-before-%TS%.txt"
findstr /c:"TABLE=1" "%PKG%\logs\check-before-%TS%.txt" >nul
if errorlevel 1 goto fail-notable
findstr /c:"SYSADMIN=1" "%PKG%\logs\check-before-%TS%.txt" >nul
if errorlevel 1 goto fail-sysadmin
echo RESULT: PREFLIGHT-OK

echo [2] backup HSDZ_MES to %BAKDIR% ...
if not exist "%BAKDIR%" mkdir "%BAKDIR%"
call sqlcmd -S localhost -E -Q "BACKUP DATABASE [HSDZ_MES] TO DISK = N'%BAKDIR%\pre-asm-bom-full-%TS%.bak' WITH FORMAT, INIT, STATS=25" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-backup
if not exist "%BAKDIR%\pre-asm-bom-full-%TS%.bak" goto fail-backup
echo RESULT: BACKUP-PASSED bak=pre-asm-bom-full-%TS%.bak

echo [3] run migration via DbSync run (records yj_schema_log) ...
copy /y "%PKG%\%SCRIPT%" "%PKG%\tools\%SCRIPT%" >nul
pushd "%PKG%\tools"
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run %SCRIPT%
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" goto fail-migrate
echo RESULT: MIGRATION-OK

rem NOTE: CHECK-after.sql is UTF-8 with Chinese column names; sqlcmd needs
rem       -f i:65001,o:65001 to read it on any server codepage (repo convention).
echo [4] verify (read-only) ...
call sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -f i:65001,o:65001 -i "%PKG%\CHECK-after.sql" -o "%PKG%\logs\check-after-%TS%.txt" >> "%LOG%" 2>&1
if errorlevel 1 goto fail-check
type "%PKG%\logs\check-after-%TS%.txt"
findstr /c:"rows=3640" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
findstr /c:"docs=827" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
findstr /c:"prods=817" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
findstr /c:"missing_unit=0" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
findstr /c:"bad_seq_docs=0" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
findstr /c:"schema_log=1" "%PKG%\logs\check-after-%TS%.txt" >nul
if errorlevel 1 goto fail-mismatch
echo RESULT: ALL-OK
echo RESULT: ALL-OK >> "%LOG%"
echo.
echo Next : open MES web UI - Data Modeling - Production - Assembly BOM
echo        expect 827 BOM documents (817 products, 10 products have 2 versions).
echo Rollback: restore %BAKDIR%\pre-asm-bom-full-%TS%.bak (full database restore),
echo           or re-run tools\migrate-asm-bom-data-20261030.sql for the old 236-product scope.
exit /b 0

:fail-java
echo RESULT: FAIL-JAVA-NOT-FOUND
exit /b 1
:fail-sqlcmd
echo RESULT: FAIL-SQLCMD-NOT-FOUND
exit /b 1
:fail-file
echo RESULT: FAIL-PACKAGE-FILE-MISSING
exit /b 1
:fail-notable
echo RESULT: FAIL-BS_ASM_BOM-MISSING
echo        dbo.bs_asm_bom does not exist. Deploy the normal incremental package
echo        first (tools\migrate-asm-bom-20261030.sql creates it).
exit /b 1
:fail-sysadmin
echo RESULT: FAIL-NOT-SYSADMIN
echo        logon account has no sysadmin role; run from an elevated cmd on the DB host
exit /b 1
:fail-backup
echo RESULT: FAIL-BACKUP
exit /b 1
:fail-migrate
echo RESULT: FAIL-MIGRATION
echo        see log: %LOG%
exit /b 1
:fail-check
echo RESULT: FAIL-CHECK-SQLCMD
exit /b 1
:fail-mismatch
echo RESULT: FAIL-CHECK-MISMATCH
echo        see: %PKG%\logs\check-after-%TS%.txt
exit /b 1
