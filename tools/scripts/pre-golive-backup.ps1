# pre-golive-backup.ps1 — 全量部署前保险备份(HSDZ_MES → deploy\HSDZ_MES_pre_golive_时间戳.bak)
# 需 Windows 管理员身份(集成认证连本机 SQL Server sysadmin)
param([string]$Source = "HSDZ_MES")
$ErrorActionPreference = "Stop"
$deployDir = "C:\INCER\YINJIA-MES\deploy"
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$bakFile = Join-Path $deployDir "HSDZ_MES_pre_golive_$stamp.bak"

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
$cmd.CommandText = "BACKUP DATABASE [$Source] TO DISK = N'$bakFile' WITH FORMAT, INIT, NAME = N'pre-golive $stamp', STATS = 25"
$cmd.ExecuteNonQuery() | Out-Null
Write-Host "保险备份完成: $bakFile"
$conn.Close()
