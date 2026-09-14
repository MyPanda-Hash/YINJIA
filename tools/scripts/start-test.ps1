# start-test.ps1 — 启动测试环境实例(HSDZ_MES_TEST,端口 8091)
# 测试库制备: 先跑同目录 make-test-db.ps1;数据随便造,不影响正式账(HSDZ_MES)
param([switch]$Stop)
$ErrorActionPreference = "Stop"
$dir = Split-Path $PSScriptRoot -Parent | Split-Path -Parent | Join-Path -ChildPath "backend"
if ($Stop) {
  Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  Write-Host "测试实例(8091)已停止"; exit 0
}
$c = Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue
if ($c) { Write-Host "测试实例已在运行: http://127.0.0.1:8091"; exit 0 }
Start-Process -FilePath "java" -ArgumentList "-jar", "target\yinjia-mes-backend-0.1.0.jar", "--spring.profiles.active=test" -WorkingDirectory $dir -WindowStyle Hidden
Write-Host "测试实例启动中(HSDZ_MES_TEST, http://127.0.0.1:8091) ..."
