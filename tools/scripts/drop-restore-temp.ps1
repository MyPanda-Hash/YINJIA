# 清理恢复用临时库 HSDZ_MES_RESTORE
$ErrorActionPreference = 'Stop'
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL ALTER DATABASE HSDZ_MES_RESTORE SET SINGLE_USER WITH ROLLBACK IMMEDIATE; IF DB_ID('HSDZ_MES_RESTORE') IS NOT NULL DROP DATABASE HSDZ_MES_RESTORE;"
$cmd.ExecuteNonQuery() | Out-Null
Write-Host 'HSDZ_MES_RESTORE 已删除'
$conn.Close()
