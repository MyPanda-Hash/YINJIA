# _restore-server-bak-to-test.ps1 - restore the SERVER's HSDZ_MES .bak into local
# test ledger HSDZ_MES_TEST (disposable). Pure ASCII. Windows integrated auth (sysadmin).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_restore-server-bak-to-test.ps1 -BakFile <path>
param([Parameter(Mandatory=$true)][string]$BakFile)
$ErrorActionPreference = 'Stop'
$Target = 'HSDZ_MES_TEST'

if (-not (Test-Path -LiteralPath $BakFile)) { throw "bak not found: $BakFile" }

function New-AdminConn {
  foreach ($cs in @(
    "Server=localhost;Integrated Security=True;TrustServerCertificate=True",
    "Server=lpc:localhost;Integrated Security=True;TrustServerCertificate=True"
  )) {
    try {
      $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
      $conn.Open(); Write-Host "admin conn OK: $cs"; return $conn
    } catch { Write-Host "  try failed: $($_.Exception.Message.Split("`n")[0])" }
  }
  throw "cannot connect with integrated auth"
}
function Invoke-Scalar($conn, $sql) {
  $c = $conn.CreateCommand(); $c.CommandText = $sql; $c.CommandTimeout = 600
  return $c.ExecuteScalar()
}
function Invoke-Exec($conn, $sql) {
  $c = $conn.CreateCommand(); $c.CommandText = $sql; $c.CommandTimeout = 1800
  $c.ExecuteNonQuery() | Out-Null
}
function Invoke-ReaderRows($conn, $sql) {
  $c = $conn.CreateCommand(); $c.CommandText = $sql; $c.CommandTimeout = 600
  $r = $c.ExecuteReader(); $rows = @()
  while ($r.Read()) {
    $row = @{}; for ($i = 0; $i -lt $r.FieldCount; $i++) { $row[$r.GetName($i)] = $r.GetValue($i) }
    $rows += ,$row
  }
  $r.Close(); return ,$rows
}

$conn = New-AdminConn

# 1) detect LOCAL default data dir (bak records the SERVER's dir - must not reuse it)
$dataDir = [string](Invoke-Scalar $conn "CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))")
Write-Host "local data dir: $dataDir"

# 2) logical files inside the bak
Write-Host "reading filelist..."
$files = Invoke-ReaderRows $conn "RESTORE FILELISTONLY FROM DISK = N'$BakFile'"
$moves = @()
foreach ($f in $files) {
  $base = (Split-Path ([string]$f.PhysicalName) -Leaf) -replace 'HSDZ_MES', $Target
  $moves += "MOVE N'$($f.LogicalName)' TO N'$(Join-Path $dataDir $base)'"
  Write-Host ("  {0} -> {1}" -f $f.LogicalName, (Join-Path $dataDir $base))
}
$moveClause = $moves -join ', '

# 3) drop old test ledger, restore server bak as new test ledger
Write-Host "restoring $Target from server bak (old test ledger replaced)..."
Invoke-Exec $conn "IF DB_ID('$Target') IS NOT NULL ALTER DATABASE [$Target] SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Invoke-Exec $conn "RESTORE DATABASE [$Target] FROM DISK = N'$BakFile' WITH RECOVERY, REPLACE, $moveClause"
Invoke-Exec $conn "IF DB_ID('$Target') IS NOT NULL AND (SELECT user_access_desc FROM sys.databases WHERE name = '$Target') <> 'MULTI_USER' ALTER DATABASE [$Target] SET MULTI_USER"

# 4) grant yinjia db_owner (DbSync needs DDL on the test ledger)
Invoke-Exec $conn "USE [$Target]; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia];"
Invoke-Exec $conn "USE [$Target]; ALTER ROLE db_owner ADD MEMBER [yinjia];"

# 5) server-state snapshot (pre-migration)
$q = @"
USE [$Target];
SELECT 'TABLES' K, CAST(COUNT(*) AS nvarchar(20)) V FROM sys.tables
UNION ALL SELECT 'SCHEMA_LOG', CAST(COUNT(*) AS nvarchar(20)) FROM yj_schema_log
UNION ALL SELECT 'PANELS', CAST(COUNT(*) AS nvarchar(20)) FROM yj_panel
UNION ALL SELECT 'USERS', CAST(COUNT(*) AS nvarchar(20)) FROM yj_user
UNION ALL SELECT 'PLANG_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM plang
UNION ALL SELECT 'PLANG_MAX_DATE', CAST(CAST(MAX(pl_date) AS date) AS nvarchar(10)) FROM plang
UNION ALL SELECT 'PLANGPC_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM plang_pc
UNION ALL SELECT 'MANU_ORDER_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order
UNION ALL SELECT 'MANU_LEGACY_BAD', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order WHERE [测试程序2] IS NOT NULL OR [生产订单客户] IS NOT NULL OR [外部单据号] IS NOT NULL OR [对方仓库] IS NOT NULL OR [启用领料申请] IS NOT NULL OR [启用派工] IS NOT NULL OR [自动转移] IS NOT NULL OR [产品自动添加到材料] IS NOT NULL
UNION ALL SELECT 'WO_REPORT_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM wo_report
UNION ALL SELECT 'SCJL_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM scjl
UNION ALL SELECT 'ATTACH_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM yj_attachment
"@
Write-Host "=== SERVER STATE SNAPSHOT (pre-migration) ==="
$c = $conn.CreateCommand(); $c.CommandText = $q; $c.CommandTimeout = 600
$r = $c.ExecuteReader()
while ($r.Read()) { Write-Host ("  {0} = {1}" -f $r.GetString(0), $r.GetString(1)) }
$r.Close()

$conn.Close()
Write-Host 'RESULT: RESTORE-TO-TEST-OK'
