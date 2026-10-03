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
# JDK discovery, VERSION-GATED (2026-09-24). Backend classes are major 69 (pom java.version=25),
# so ANY JDK < 25 aborts with UnsupportedClassVersionError. Trusting $env:JAVA_HOME blindly is not
# enough: this machine's machine-level JAVA_HOME points at openjdk-23.0.1 (real failure observed
# 2026-09-24). We therefore validate each candidate via its `release` file (JAVA_VERSION >= 25) —
# same policy as start-project.bat :TRYJDK.
function Test-Jdk25([string]$jdkHome) {
  if (-not $jdkHome) { return $false }
  $java = Join-Path $jdkHome 'bin\java.exe'
  $rel = Join-Path $jdkHome 'release'
  if (-not (Test-Path $java) -or -not (Test-Path $rel)) { return $false }
  $line = Select-String -Path $rel -Pattern '^JAVA_VERSION="([0-9]+)' | Select-Object -First 1
  if (-not $line) { return $false }
  $maj = [int]$line.Matches[0].Groups[1].Value
  return ($maj -ge 25)
}
$jdkCands = @()
if ($env:JAVA_HOME) { $jdkCands += $env:JAVA_HOME.TrimEnd('\') }
foreach ($d in @("$env:USERPROFILE\.jdks", 'C:\Program Files\Java', 'D:\Program Files\Java')) {
  if (Test-Path $d) { $jdkCands += (Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
}
$jdk25 = $jdkCands | Where-Object { Test-Jdk25 $_ } | Select-Object -First 1
if ($jdk25) {
  if ($jdk25 -ne ($env:JAVA_HOME -replace '\\$', '')) { Write-Host "JDK: 使用 $jdk25 (环境 JAVA_HOME 未达 25 或未设)" }
  $env:JAVA_HOME = $jdk25
} else {
  Write-Host "[WARN] JDK 25+ not found - backend will fail to start (classes are major 69)." -ForegroundColor Yellow
}
$javaExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" } else { 'java' }

# 2026-09-24 起:启动前先做数据库增量同步(治本"拉了代码没跑 SQL"⇒ 界面与实现不一致)。
# 只跑 db-migrations.txt 里新增/内容变化的脚本(幂等);失败不阻断启动,但红字告警。
$root = Split-Path $dir -Parent
$syncBat = Join-Path $root "tools\sync-db.bat"
if (Test-Path $syncBat) {
  Write-Host "数据库增量同步(tools\sync-db.bat) ..."
  & cmd /c "`"$syncBat`""
  if ($LASTEXITCODE -ne 0) {
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "[警告] 数据库同步失败:界面/字段可能与代码实现不一致!" -ForegroundColor Red
    Write-Host "       处理:确认 SQL Server(Docker mssql2019)在跑后重跑 tools\sync-db.bat" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
  }
}

Start-Process -FilePath $javaExe -ArgumentList "-jar", "target\yinjia-mes-backend-0.1.0.jar" -WorkingDirectory $dir -WindowStyle Hidden
Write-Host "正式实例启动中(HSDZ_MES, http://127.0.0.1:8090;$javaExe) ..."
