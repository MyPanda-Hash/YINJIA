# restore-srv-snap.ps1 —— 把「服务器数据库备份」里的 .bak 还原成临时库 HSDZ_SRVSNAP(只读取证用)
#   为什么:测试库的 mate(物料清单)只有 2 行演示数据,要先确认**服务器上到底有没有**真实物料清单,
#   才知道「补齐」是「从服务器搬」还是「按现有口径造演示数据」。
#   权限:集成认证 + 本机 sysadmin(yinjia 应用账号无 RESTORE 权限)。
#   用完可: ALTER DATABASE HSDZ_SRVSNAP SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE HSDZ_SRVSNAP;
$ErrorActionPreference = 'Stop'
$bak = 'D:\YINJIA-main\服务器数据库备份\HSDZ_MES_manual_20261111-110118.bak'
if (-not (Test-Path $bak)) { throw "找不到备份文件: $bak" }

function New-AdminConn {
  $conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True")
  $conn.Open(); return $conn
}
function Invoke-Exec($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800
  $cmd.ExecuteNonQuery() | Out-Null
}

$conn = New-AdminConn
Invoke-Exec $conn "IF DB_ID('HSDZ_SRVSNAP') IS NOT NULL ALTER DATABASE HSDZ_SRVSNAP SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Invoke-Exec $conn "IF DB_ID('HSDZ_SRVSNAP') IS NOT NULL DROP DATABASE HSDZ_SRVSNAP"

$cmd = $conn.CreateCommand()
$cmd.CommandText = "RESTORE FILELISTONLY FROM DISK='$bak'"
$cmd.CommandTimeout = 600
$r = $cmd.ExecuteReader(); $dt = New-Object System.Data.DataTable; $dt.Load($r); $r.Close()
$mdf = $dt.Rows[0]['LogicalName']; $ldf = $dt.Rows[1]['LogicalName']
Write-Host "logical: $mdf / $ldf"

$dp = $conn.CreateCommand(); $dp.CommandText = "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000))"
$dataPath = [string]$dp.ExecuteScalar()
if (-not $dataPath) { $dataPath = 'C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\' }
if (-not $dataPath.EndsWith('\')) { $dataPath += '\' }
Write-Host "dataPath: $dataPath"

Invoke-Exec $conn ("RESTORE DATABASE HSDZ_SRVSNAP FROM DISK='$bak' WITH " +
  "MOVE '$mdf' TO '$dataPath`HSDZ_SRVSNAP.mdf', MOVE '$ldf' TO '$dataPath`HSDZ_SRVSNAP_log.ldf', RECOVERY")
Invoke-Exec $conn "USE HSDZ_SRVSNAP; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia]; ALTER ROLE db_owner ADD MEMBER [yinjia];"
Write-Host 'RESTORE ok -> HSDZ_SRVSNAP'
$conn.Close()
