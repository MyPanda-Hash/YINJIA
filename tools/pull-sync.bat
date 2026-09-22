@echo off
chcp 65001 >nul
rem YINJIA-MES pull + sync DB: git pull -> DbSync applies db-migrations.txt incrementally
setlocal
cd /d "%~dp0"

rem ---- JDK detection (same as build.bat) ----
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
for %%D in ("C:\Program Files\Java\jdk-25" "D:\Program Files\Java\jdk-25" "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul || ( echo [ERROR] JDK 25 not found & goto :fail )
:jdk_ok

rem ---- JDBC driver: tools\lib first, then local .m2-repo ----
set "JDBC=%~dp0lib\mssql-jdbc.jar"
if not exist "%JDBC%" set "JDBC=%~dp0..\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.2.jre11\mssql-jdbc-12.8.2.jre11.jar"
if not exist "%JDBC%" (
  echo [ERROR] mssql-jdbc driver not found: tools\lib\mssql-jdbc.jar
  echo        and not under %~dp0..\.m2-repo\...\mssql-jdbc-12.8.2.jre11.jar ^(built once with backend^)
  goto :fail
)

echo [1/2] git pull ...
git -C "%~dp0.." pull
if errorlevel 1 ( echo [ERROR] git pull failed; resolve conflicts before syncing DB & goto :fail )

echo.
echo [2/2] syncing database HSDZ_MES (only new/changed scripts)...
"%JAVA_HOME%\bin\java.exe" -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp "%JDBC%" DbSync.java
if errorlevel 1 ( echo [ERROR] database sync failed; see output above & goto :fail )

echo.
echo Done: code and database are in sync.
goto :eof

:fail
pause
exit /b 1
