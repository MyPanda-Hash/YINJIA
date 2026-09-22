# start-prod.ps1 — 启动正式环境实例(HSDZ_MES,端口 8090)
# OCR 密钥从环境变量注入(不落库不入 git):$env:ALIBABA_CLOUD_ACCESS_KEY_ID / $env:ALIBABA_CLOUD_ACCESS_KEY_SECRET
param([switch]$Stop)
$ErrorActionPreference = "Stop"
$dir = Split-Path $PSScriptRoot -Parent | Split-Path -Parent | Join-Path -ChildPath "backend"
if ($Stop) {
  Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  Write-Host "正式实例(8090)已停止"; exit 0
}
$c = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
if ($c) { Write-Host "正式实例已在运行: http://127.0.0.1:8090"; exit 0 }
# JDK 探测(按 docs/development/环境与数据库.md「开发机环境」的约定,与 build-appjar.ps1 同一套):
# 后端 class 是 25(pom java.version=25),用裸 `java` 会撞上 2026-09-22 之前打开的终端 ——
# 那些 shell 的 PATH 仍是旧 Oracle javapath(JDK 24)⇒ 起进程即抛 UnsupportedClassVersionError(class 69>68)。
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  foreach ($cand in @('C:\Program Files\Java\jdk-25', 'D:\Program Files\Java\jdk-25', "$env:USERPROFILE\.jdk\jdk-25\jdk-25.0.2")) {
    if (Test-Path "$cand\bin\java.exe") { $env:JAVA_HOME = $cand; break }
  }
}
$javaExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" } else { 'java' }
Start-Process -FilePath $javaExe -ArgumentList "-jar", "target\yinjia-mes-backend-0.1.0.jar" -WorkingDirectory $dir -WindowStyle Hidden
Write-Host "正式实例启动中(HSDZ_MES, http://127.0.0.1:8090;$javaExe) ..."
