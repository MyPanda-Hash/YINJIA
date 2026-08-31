@echo off
chcp 65001 >nul
rem YINJIA-MES 拉取云端 + 同步数据库:git pull -> DbSync 按 db-migrations.txt 增量执行
setlocal
cd /d "%~dp0"

rem ---- JDK 探测(与 build.bat 一致) ----
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
for %%D in ("C:\Program Files\Java\jdk-26.0.2" "D:\Program Files\Java\jdk-26.0.2" "D:\Program Files\Java\jdk-24" "C:\Program Files\Java\jdk-17") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul || ( echo [错误] 未找到 JDK ^(17+^) & goto :fail )
:jdk_ok

rem ---- JDBC 驱动:优先 tools\lib,其次本地 .m2-repo ----
set "JDBC=%~dp0lib\mssql-jdbc.jar"
if not exist "%JDBC%" set "JDBC=%~dp0..\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar"
if not exist "%JDBC%" (
  echo [错误] 未找到 mssql-jdbc 驱动: tools\lib\mssql-jdbc.jar
  echo        也没有 %~dp0..\.m2-repo\...\mssql-jdbc-12.8.1.jre11.jar ^(构建一次后端即可生成^)
  goto :fail
)

echo [1/2] git pull ...
git -C "%~dp0.." pull
if errorlevel 1 ( echo [错误] git pull 失败,先解决冲突再同步数据库 & goto :fail )

echo.
echo [2/2] 同步数据库 HSDZ_MES(仅执行新增/有变化的脚本)...
"%JAVA_HOME%\bin\java.exe" -cp "%JDBC%" DbSync.java
if errorlevel 1 ( echo [错误] 数据库同步失败,查看上方输出 & goto :fail )

echo.
echo 完成:代码与数据库均已同步。
goto :eof

:fail
pause
exit /b 1
