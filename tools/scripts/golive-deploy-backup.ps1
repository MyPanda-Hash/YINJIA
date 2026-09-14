# golive-deploy-backup.ps1 — 部署用全量备份(清理后的干净账 HSDZ_MES → deploy\HSDZ_MES_golive_时间戳.bak)
$ErrorActionPreference = "Stop"
$deployDir = "C:\INCER\YINJIA-MES\deploy"
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$bakFile = Join-Path $deployDir "HSDZ_MES_golive_$stamp.bak"

function New-AdminConn {
  foreach ($cs in @(
    "Server=localhost;Integrated Security=True;TrustServerCertificate=True",
    "Server=lpc:localhost;Integrated Security=True;TrustServerCertificate=True"
  )) {
    try { $conn = New-Object System.Data.SqlClient.SqlConnection($cs); $conn.Open(); return $conn } catch {}
  }
  throw "无法以集成认证连接 SQL Server"
}

$conn = New-AdminConn
$cmd = $conn.CreateCommand()
$cmd.CommandTimeout = 1800
$cmd.CommandText = "BACKUP DATABASE [HSDZ_MES] TO DISK = N'$bakFile' WITH FORMAT, INIT, NAME = N'golive deploy $stamp', STATS = 25"
$cmd.ExecuteNonQuery() | Out-Null
Write-Host "部署备份完成: $bakFile"
Write-Host "此文件即服务器全量恢复用库(还原脚本见 deploy/部署说明.md 一、3)"
$conn.Close()
