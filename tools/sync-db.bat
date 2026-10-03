@echo off
rem sync-db.bat - incremental DB sync (single entry): run new/changed scripts listed in tools\db-migrations.txt
rem WHY: git pull only updates code; SQL scripts are NOT executed by pull. Un-synced DB =>
rem      panel names / fields / permissions / new tables differ from code
rem      (e.g. missing 结案人/打印人 columns makes 结案 fail with "Invalid column name").
rem USAGE:
rem   tools\sync-db.bat        -> prod ledger HSDZ_MES (default)
rem   tools\sync-db.bat test   -> test ledger HSDZ_MES_TEST (fails loudly when the DB is absent)
rem IDEMPOTENT: yj_schema_log tracks content_hash; unchanged scripts are skipped.
rem NOTE: keep this file ASCII-only + CRLF. Chinese text in .bat gets shredded when the
rem       codepage switch (chcp 65001) does not take effect (project already hit this twice).
setlocal
cd /d "%~dp0"

rem ---- JDK discovery (same policy as build.bat / pull-sync.bat: JAVA_HOME first, then JDK 25 dirs) ----
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
for %%D in ("%USERPROFILE%\.jdks\ms-25.0.4" "%USERPROFILE%\.jdks\temurin-25.0.4.1" "C:\Program Files\Java\jdk-25" "D:\Program Files\Java\jdk-25" "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul || ( echo [ERROR] JDK 25 not found & goto :fail )
:jdk_ok

rem ---- JDBC driver: tools\lib first, then local .m2-repo ----
set "JDBC=%~dp0lib\mssql-jdbc.jar"
if not exist "%JDBC%" set "JDBC=%~dp0..\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.2.jre11\mssql-jdbc-12.8.2.jre11.jar"
if not exist "%JDBC%" (
  echo [ERROR] mssql-jdbc driver not found ^(tools\lib\mssql-jdbc.jar or the .m2-repo copy^)
  goto :fail
)

if /i "%~1"=="test" (
  set "YINJIA_SQL_DB=HSDZ_MES_TEST"
  echo [DB] test ledger HSDZ_MES_TEST
) else (
  echo [DB] prod ledger HSDZ_MES
)

"%JAVA_HOME%\bin\java.exe" -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp "%JDBC%" DbSync.java
if errorlevel 1 ( echo [ERROR] DB sync failed, see output above & goto :fail )
echo DB sync done.
goto :eof

:fail
exit /b 1
