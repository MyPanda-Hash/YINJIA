@echo off
REM _grant-ddladmin.bat - Grant db_ddladmin to SQL login yinjia (single-user mode dance, same as DbInit)
REM Double-click is OK: it self-elevates (click YES on the UAC prompt).
REM SQL Server will restart twice (a few seconds each).

REM ---- self-elevation ----
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator privileges - click YES on the UAC prompt...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d C:\INCER\YINJIA-MES

echo [1/5] Stopping SQL Server...
net stop MSSQLSERVER /y

echo [2/5] Starting SQL Server in single-user mode...
net start MSSQLSERVER /m

echo [3/5] Granting db_ddladmin to yinjia (JDBC NTLM)...
set ADMINPW=Yin#Admin#2026xQ
if not "%~1"=="" set ADMINPW=%~1
java -cp ".m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar" tools\_RunSql.java - --grant-only --adminpw "%ADMINPW%"
if not errorlevel 2 goto :granted

echo JDBC NTLM failed - trying .NET SqlClient fallback (non-ODBC, still single-user)...
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\INCER\YINJIA-MES\tools\_grant-net.ps1"
if errorlevel 1 goto :grantfailed

:granted

echo [4/5] Restarting SQL Server (normal mode)...
net stop MSSQLSERVER /y
net start MSSQLSERVER

echo [5/5] DONE. yinjia now has db_ddladmin. Report: tools\_flow-v12\_grant-out.txt
pause
exit /b 0

:grantfailed
echo GRANT FAILED - restarting SQL Server in normal mode anyway...
net stop MSSQLSERVER /y
net start MSSQLSERVER
echo See tools\_flow-v12\_grant-out.txt for the error.
pause
exit /b 2
