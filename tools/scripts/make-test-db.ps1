# make-test-db.ps1 — 从 HSDZ_MES 备份并还原出测试库 HSDZ_MES_TEST(同一 SQL Server 实例)
# 用法: powershell -File make-test-db.ps1 [-Source HSDZ_MES] [-Target HSDZ_MES_TEST] [-BackupDir C:\SQLBackup]
# 权限: 需 Windows 管理员身份运行(集成认证走本机 sysadmin;yinjia 账号无 CREATE DATABASE 权限)
param(
  [string]$Source = "HSDZ_MES",
  [string]$Target = "HSDZ_MES_TEST",
  [string]$BackupDir = "C:\SQLBackup"
)
$ErrorActionPreference = "Stop"

function New-AdminConn {
  foreach ($cs in @(
    "Server=localhost;Integrated Security=True;TrustServerCertificate=True",
    "Server=lpc:localhost;Integrated Security=True;TrustServerCertificate=True",
    "Server=.\;Integrated Security=True;TrustServerCertificate=True"
  )) {
    try {
      $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
      $conn.Open()
      Write-Host "管理连接成功: $cs"
      return $conn
    } catch { Write-Host "  尝试失败: $($_.Exception.Message.Split("`n")[0])" }
  }
  throw "无法以 Windows 集成认证连接 SQL Server"
}

function Invoke-Scalar($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 600
  return $cmd.ExecuteScalar()
}
function Invoke-Exec($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800
  $cmd.ExecuteNonQuery() | Out-Null
}
function Invoke-ReaderRows($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 600
  $r = $cmd.ExecuteReader()
  $rows = @()
  while ($r.Read()) {
    $row = @{}
    for ($i = 0; $i -lt $r.FieldCount; $i++) { $row[$r.GetName($i)] = $r.GetValue($i) }
    $rows += ,$row
  }
  $r.Close(); return ,$rows
}

$conn = New-AdminConn

# ① 备份目录
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
$bakFile = Join-Path $BackupDir "$Source-for-test.bak"
Write-Host "① 备份 $Source → $bakFile ..."
Invoke-Exec $conn "BACKUP DATABASE [$Source] TO DISK = N'$bakFile' WITH INIT, NAME = N'seed for $Target', STATS = 25"

# ② 还原前探文件逻辑名
Write-Host "② 读取备份文件清单..."
$files = Invoke-ReaderRows $conn "RESTORE FILELISTONLY FROM DISK = N'$bakFile'"
$moves = @()
foreach ($f in $files) {
  $phys = [string]$f.PhysicalName
  $dir = Split-Path $phys -Parent
  $base = (Split-Path $phys -Leaf) -replace [regex]::Escape($Source), $Target
  $newPhys = Join-Path $dir $base
  $moves += "MOVE N'$($f.LogicalName)' TO N'$newPhys'"
}
$moveClause = ($moves -join ", ")

# ③ 还原为测试库(存在则覆盖)
Write-Host "③ 还原为 $Target ..."
Invoke-Exec $conn "IF DB_ID('$Target') IS NOT NULL ALTER DATABASE [$Target] SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Invoke-Exec $conn "RESTORE DATABASE [$Target] FROM DISK = N'$bakFile' WITH RECOVERY, REPLACE, $moveClause"
Invoke-Exec $conn "IF DB_ID('$Target') IS NOT NULL AND (SELECT user_access_desc FROM sys.databases WHERE name = '$Target') <> 'MULTI_USER' ALTER DATABASE [$Target] SET MULTI_USER"

# ④ 测试库授权:yinjia → db_owner(测试库随便折腾)
Write-Host "④ 目标库授权 yinjia db_owner ..."
Invoke-Exec $conn "USE [$Target]; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia];"
Invoke-Exec $conn "USE [$Target]; ALTER ROLE db_owner ADD MEMBER [yinjia];"

# ⑤ 汇总
$rowCount = Invoke-Scalar $conn "USE [$Target]; SELECT SUM(1) FROM sys.tables"
Write-Host "完成: 测试库 $Target 已建立(表 $rowCount 张),yinjia 为 db_owner。"
Write-Host "登录时选择工厂「YINJIA-MES·测试库」即切入本库(单实例账套路由,ADR-0003)"
$conn.Close()
