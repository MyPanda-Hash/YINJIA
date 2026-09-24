# 从合并轮快照还原临时库(供字段丢失时点定位)
$ErrorActionPreference = 'Stop'
function New-AdminConn {
  $conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True")
  $conn.Open(); return $conn
}
function Invoke-Exec($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800
  $cmd.ExecuteNonQuery() | Out-Null
}
$conn = New-AdminConn
Invoke-Exec $conn "IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL ALTER DATABASE HSDZ_MES_RESTORE SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Invoke-Exec $conn "IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL DROP DATABASE HSDZ_MES_RESTORE"
$cmd = $conn.CreateCommand(); $cmd.CommandText = "RESTORE FILELISTONLY FROM DISK='C:\SQLBackup\HSDZ_MES-for-test.bak'"; $cmd.CommandTimeout = 600
$r = $cmd.ExecuteReader(); $dt = New-Object System.Data.DataTable; $dt.Load($r); $r.Close()
$mdf = $dt.Rows[0]['LogicalName']; $ldf = $dt.Rows[1]['LogicalName']
Invoke-Exec $conn "RESTORE DATABASE HSDZ_MES_RESTORE FROM DISK='C:\SQLBackup\HSDZ_MES-for-test.bak' WITH MOVE '$mdf' TO 'C:\SQLBackup\HSDZ_MES_RESTORE.mdf', MOVE '$ldf' TO 'C:\SQLBackup\HSDZ_MES_RESTORE_log.ldf', RECOVERY"
Invoke-Exec $conn "USE HSDZ_MES_RESTORE; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia]; ALTER ROLE db_owner ADD MEMBER [yinjia];"
Write-Host 'RESTORE ok'
$conn.Close()
