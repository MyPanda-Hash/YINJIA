# _restore.ps1 - restore a server backup into local HSDZ_MES (overwrite), with a safety backup first.
# usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File _restore.ps1 -Bak "D:\...\x.bak"
# NOTE: ASCII only (Windows PowerShell 5.1 reads non-BOM files as ANSI).
param(
  [Parameter(Mandatory=$true)][string]$Bak,
  [string]$TargetDb = "HSDZ_MES",
  [string]$SafetyDir = "D:\workspace\yinjia\deploy"
)
$ErrorActionPreference = "Stop"

function New-Conn {
  $c = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=15")
  $c.Open(); return $c
}
function Scalar($c, $sql) { $cmd = $c.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800; return $cmd.ExecuteScalar() }
function Exec($c, $sql) { $cmd = $c.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 1800; $cmd.ExecuteNonQuery() | Out-Null }
function Rows($c, $sql) {
  $cmd = $c.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 600
  $r = $cmd.ExecuteReader(); $out = @()
  while ($r.Read()) { $o = [ordered]@{}; for ($i=0; $i -lt $r.FieldCount; $i++) { $o[$r.GetName($i)] = $r.GetValue($i) }; $out += [pscustomobject]$o }
  $r.Close(); return ,$out
}

$c = New-Conn
$login = Scalar $c "SELECT SUSER_SNAME()"
$sa = Scalar $c "SELECT IS_SRVROLEMEMBER('sysadmin')"
Write-Host "login=$login  sysadmin=$sa"
if ($sa -ne 1) { Write-Host "ERROR: not sysadmin, cannot restore."; $c.Close(); exit 2 }
if (-not (Test-Path $Bak)) { Write-Host "ERROR: backup not found: $Bak"; $c.Close(); exit 3 }
Write-Host ("[1] backup file: {0}  ({1:N1} MB)" -f $Bak, ((Get-Item $Bak).Length/1MB))

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safety = Join-Path $SafetyDir "$TargetDb-before-import-$stamp.bak"
Write-Host "[2] safety backup -> $safety"
Exec $c "BACKUP DATABASE [$TargetDb] TO DISK = N'$safety' WITH INIT, NAME = N'before-import', STATS = 25"
Write-Host ("    done ({0:N1} MB)" -f ((Get-Item $safety).Length/1MB))

$files = Rows $c "RESTORE FILELISTONLY FROM DISK = N'$Bak'"
Write-Host "[3] files inside backup:"
$files | ForEach-Object { Write-Host ("    LogicalName={0}  Type={1}  Physical={2}" -f $_.LogicalName, $_.Type, $_.PhysicalName) }

$cur = Rows $c "SELECT name, physical_name, type_desc FROM sys.master_files WHERE database_id = DB_ID(N'$TargetDb')"
$dataPath = ($cur | Where-Object { $_.type_desc -eq 'ROWS' } | Select-Object -First 1).physical_name
$logPath  = ($cur | Where-Object { $_.type_desc -eq 'LOG'  } | Select-Object -First 1).physical_name
Write-Host "[4] targets: data=$dataPath  log=$logPath"

$moves = @()
foreach ($f in $files) {
  $to = if ($f.Type -eq 'L') { $logPath } else { $dataPath }
  $moves += "MOVE N'$($f.LogicalName)' TO N'$to'"
}
$moveClause = ($moves -join ", ")

Write-Host "[5] restoring (overwrite) $TargetDb ..."
Exec $c "IF DB_ID(N'$TargetDb') IS NOT NULL ALTER DATABASE [$TargetDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
Exec $c "RESTORE DATABASE [$TargetDb] FROM DISK = N'$Bak' WITH REPLACE, RECOVERY, $moveClause"
Exec $c "ALTER DATABASE [$TargetDb] SET MULTI_USER"

Exec $c "USE [$TargetDb]; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia]; ALTER ROLE db_owner ADD MEMBER [yinjia];"

$tbl = Scalar $c "USE [$TargetDb]; SELECT COUNT(*) FROM sys.tables"
$rows = Scalar $c "USE [$TargetDb]; SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'"
$closeCnt = Scalar $c "USE [$TargetDb]; SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') IN ('T','Y')"
Write-Host "[6] DONE: tables=$tbl ; plang active rows=$rows (closed=$closeCnt)"
$c.Close()
