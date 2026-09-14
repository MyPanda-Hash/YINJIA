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
Start-Process -FilePath "java" -ArgumentList "-jar", "target\yinjia-mes-backend-0.1.0.jar" -WorkingDirectory $dir -WindowStyle Hidden
Write-Host "正式实例启动中(HSDZ_MES, http://127.0.0.1:8090) ..."
