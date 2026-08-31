# 一次性修复:yinjia 补回 db_ddladmin 角色(约 3 秒)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$c = $null
foreach ($ds in @('127.0.0.1', 'localhost')) {
    try {
        $c = New-Object System.Data.SqlClient.SqlConnection "Data Source=$ds;Initial Catalog=master;Integrated Security=SSPI;TrustServerCertificate=True;Encrypt=False;Connect Timeout=8"
        $c.Open(); break
    } catch { }
}
if (-not $c) { Write-Host '[失败] 连接未成功'; Read-Host '回车退出'; exit 1 }

$cmd = $c.CreateCommand()
$cmd.CommandText = "USE HSDZ_MES; IF IS_ROLEMEMBER('db_ddladmin','yinjia') = 0 ALTER ROLE db_ddladmin ADD MEMBER yinjia; SELECT IS_ROLEMEMBER('db_ddladmin','yinjia') AS ok"
$r = $cmd.ExecuteReader()
while ($r.Read()) { Write-Host "yinjia 在 db_ddladmin 中: $($r['ok'])" }
$r.Close()
Write-Host '=== 完成,请回到对话 ==='
Read-Host '回车退出'
