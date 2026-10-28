@echo off
REM build-apk.bat — 一键构建安卓 APK(2026-10-21)
REM
REM 为什么需要这个脚本:Gradle 8.11 不认 JDK 25(class major 69),必须用 Android Studio
REM 自带的 JBR 21;而本机 PATH 上的 java 是 25。不设 JAVA_HOME 会报
REM 「Unsupported class file major version 69」。
REM
REM 用法:在 frontend 目录双击,或命令行 frontend\build-apk.bat
REM 产物:frontend\android\app\build\outputs\apk\debug\app-debug.apk

setlocal
cd /d "%~dp0"

echo [1/4] 构建前端...
call npm run build
if errorlevel 1 goto :fail

echo [2/4] 同步到 Android 工程...
call npx cap sync android
if errorlevel 1 goto :fail

echo [3/4] 用 JBR 21 编译 APK...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [错误] 找不到 Android Studio 自带 JBR:%JAVA_HOME%
  echo         请确认 Android Studio 安装在默认路径,或改本脚本的 JAVA_HOME。
  goto :fail
)
cd android
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 goto :fail
cd ..

echo [4/4] 完成,产物:
echo   %CD%\android\app\build\outputs\apk\debug\app-debug.apk
dir /b "android\app\build\outputs\apk\debug\app-debug.apk"
goto :eof

:fail
echo.
echo [失败] 构建中断,请看上面的错误。
exit /b 1
