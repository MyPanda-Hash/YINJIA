# 建空链验证库 HSDZ_MES_CHAIN(整条迁移链从头跑,产出链定义的标准字段态)
$ErrorActionPreference = 'Stop'
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True")
$conn.Open()
function Exec($sql) { $c = $conn.CreateCommand(); $c.CommandText = $sql; $c.CommandTimeout = 1800; $c.ExecuteNonQuery() | Out-Null }
Exec "IF DB_ID('HSDZ_MES_CHAIN') IS NOT NULL ALTER DATABASE HSDZ_MES_CHAIN SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Exec "IF DB_ID('HSDZ_MES_CHAIN') IS NOT NULL DROP DATABASE HSDZ_MES_CHAIN"
Exec "CREATE DATABASE HSDZ_MES_CHAIN"
Exec "USE HSDZ_MES_CHAIN; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia]; ALTER ROLE db_owner ADD MEMBER [yinjia];"
Write-Host 'HSDZ_MES_CHAIN 就绪(空库)'
$conn.Close()
