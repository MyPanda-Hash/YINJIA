# _grant-net.ps1 — 单用户模式下用 .NET SqlClient(非ODBC,绕开 Driver17 SSPI bug)集成认证授权
# 由 _grant-ddladmin.bat 在服务已进入单用户模式时调用(需管理员)
$ErrorActionPreference = 'Stop'
$conns = @(
  "Server=lpc:.;Database=HSDZ_MES;Integrated Security=True;Connect Timeout=8",
  "Server=np:\\.\pipe\MSSQL`$MSSQLSERVER\sql\query;Database=HSDZ_MES;Integrated Security=True;Connect Timeout=8",
  "Server=127.0.0.1;Database=HSDZ_MES;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8"
)
$c = $null; $lastErr = $null
foreach ($cs in $conns) {
  try {
    $c = New-Object System.Data.SqlClient.SqlConnection $cs
    $c.Open()
    Write-Host "[net] connected via: $cs"
    break
  } catch { $c = $null; $lastErr = $_.Exception.Message; Write-Host "[net] fail: $cs => $lastErr" }
}
if (-not $c) { Write-Host "[net] FAILED all transports"; "GRANT FAILED (.NET all transports): $lastErr" | Out-File -FilePath "C:\INCER\YINJIA-MES\tools\_flow-v12\_grant-out.txt" -Encoding utf8; exit 2 }
try {
  $cmd = $c.CreateCommand()
  $cmd.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER yinjia FOR LOGIN yinjia;
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia' AND r.name='db_ddladmin') ALTER ROLE db_ddladmin ADD MEMBER yinjia;
SELECT r.name FROM sys.database_role_members m JOIN sys.database_principals r ON r.principal_id=m.role_principal_id JOIN sys.database_principals u ON u.principal_id=m.member_principal_id WHERE u.name='yinjia';
"@
  $r = $cmd.ExecuteReader()
  $roles = @()
  while ($r.Read()) { $roles += $r.GetString(0) }
  $r.Close()
  Write-Host "[net] GRANT OK — yinjia roles: $($roles -join ' ')"
  $c.Close()
  "GRANT OK (.NET) roles: $($roles -join ' ')" | Out-File -FilePath "C:\INCER\YINJIA-MES\tools\_flow-v12\_grant-out.txt" -Encoding utf8
  exit 0
} catch {
  Write-Host "[net] FAILED: $($_.Exception.Message)"
  "GRANT FAILED (.NET): $($_.Exception.Message)" | Out-File -FilePath "C:\INCER\YINJIA-MES\tools\_flow-v12\_grant-out.txt" -Encoding utf8
  exit 2
}
