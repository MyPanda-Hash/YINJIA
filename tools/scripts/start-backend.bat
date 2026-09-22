@echo off
rem YINJIA-MES backend launcher (auto-inject Aliyun AK from user env vars for OCR + MT)
rem NOTE: keep this file ASCII-only - cmd misparses UTF-8 Chinese comments.
setlocal

rem ---- JDK detect: JAVA_HOME -> common dirs -> PATH ----
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ok
for %%D in ("%USERPROFILE%\.jdks\temurin-25.0.4.1" "C:\Program Files\Java\jdk-25" "D:\Program Files\Java\jdk-25" "%USERPROFILE%\.jdk\jdk-25\jdk-25.0.2") do (
  if exist "%%~D\bin\java.exe" ( set "JAVA_HOME=%%~D" & goto :jdk_ok )
)
where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] JDK 25 not found
  exit /b 1
)
:jdk_ok
cd /d "%~dp0..\backend"

set "AK="
set "SK="
if defined ALIBABA_CLOUD_ACCESS_KEY_ID (
  set "AK=%ALIBABA_CLOUD_ACCESS_KEY_ID%"
  set "SK=%ALIBABA_CLOUD_ACCESS_KEY_SECRET%"
) else (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ALIBABA_CLOUD_ACCESS_KEY_ID','User')"`) do set "AK=%%i"
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ALIBABA_CLOUD_ACCESS_KEY_SECRET','User')"`) do set "SK=%%i"
)

echo [YINJIA-MES backend] port 8090, AK: %AK:~0,6%***
"%JAVA_HOME%\bin\java.exe" -jar target\yinjia-mes-backend-0.1.0.jar --yinjia.ocr.access-key-id=%AK% --yinjia.ocr.access-key-secret=%SK%
