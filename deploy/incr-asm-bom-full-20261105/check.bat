@echo off
setlocal EnableExtensions
REM Read-only verification of the ASM_BOM full import (changes nothing).
cd /d "%~dp0"
set "PKG=%~dp0"
if "%PKG:~-1%"=="\" set "PKG=%PKG:~0,-1%"
where sqlcmd >nul 2>nul
if errorlevel 1 (echo RESULT: FAIL-SQLCMD-NOT-FOUND & exit /b 1)
if not exist "%PKG%\CHECK-after.sql" (echo RESULT: FAIL-CHECK-SQL-MISSING & exit /b 1)
chcp 65001 >nul
call sqlcmd -S localhost -d HSDZ_MES -E -h -1 -W -f i:65001,o:65001 -i "%PKG%\CHECK-after.sql"
echo RESULT: CHECK-DONE
exit /b 0
