# 从合并轮快照(HSDZ_MES-for-test.bak)还原临时库 HSDZ_MES_RESTORE,供 QC_RECV 域行恢复
$ErrorActionPreference = 'Stop'
function New-AdminConn {
  $conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True")
  $conn.Open(); return $conn
}
function Invoke-Exec($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800
  $cmd.ExecuteNonQuery() | Out-Null
}
function Invoke-ReaderRows($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 600
  $r = $cmd.ExecuteReader(); $rows = @()
  while ($r.Read()) { $rows += , @($r.GetValues(@(0..($r.FieldCount - 1) | ForEach-Object { $null }))) }
  $r.Close(); return $rows
}
$conn = New-AdminConn
Invoke-Exec $conn "IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL ALTER DATABASE HSDZ_MES_RESTORE SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Invoke-Exec $conn "IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL DROP DATABASE HSDZ_MES_RESTORE"

$cmd = $conn.CreateCommand(); $cmd.CommandText = "RESTORE FILELISTONLY FROM DISK='C:\SQLBackup\HSDZ_MES-for-test.bak'"; $cmd.CommandTimeout = 600
$r = $cmd.ExecuteReader(); $dt = New-Object System.Data.DataTable; $dt.Load($r); $r.Close()
$mdf = $dt.Rows[0]['LogicalName']; $ldf = $dt.Rows[1]['LogicalName']
Write-Host "备份逻辑名: $mdf / $ldf"

Invoke-Exec $conn "RESTORE DATABASE HSDZ_MES_RESTORE FROM DISK='C:\SQLBackup\HSDZ_MES-for-test.bak' WITH MOVE '$mdf' TO 'C:\SQLBackup\HSDZ_MES_RESTORE.mdf', MOVE '$ldf' TO 'C:\SQLBackup\HSDZ_MES_RESTORE_log.ldf', RECOVERY"
Invoke-Exec $conn "USE HSDZ_MES_RESTORE; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia]; ALTER ROLE db_owner ADD MEMBER [yinjia];"
Write-Host 'RESTORE 库就绪:HSDZ_MES_RESTORE(临时,恢复完即删)'
$conn.Close()
