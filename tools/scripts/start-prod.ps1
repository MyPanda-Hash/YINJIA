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
# 阿里云密钥(OCR + 机翻)从 backend\.env 注入 —— 与 start-project.bat 同一口径。
# ⚠ 不注入的后果是**静默降级**:OCR 报「未配置」、/api/locale/dict 返回空词典(机翻兜底失效)。
#   2026-09-23 实测就因此以为机翻不可用。缺失只提示,不阻断启动。
$envFile = Join-Path $dir ".env"
if (Test-Path $envFile) {
  $n = 0
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#') -or $t -notmatch '=') { continue }
    $kv = $t -split '=', 2
    [Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim(), 'Process')
    $n++
  }
  Write-Host "已从 backend\.env 注入 $n 个环境变量(OCR/机翻密钥)"
} else {
  Write-Host "提示: 无 backend\.env,OCR 与机翻将降级(功能可用但报未配置)"
}
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
