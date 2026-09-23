param(
  [string]$Source = 'HSDZ_MES_TEST',
  [string]$Target = 'HSDZ_CLONE_TMP',
  [string]$LogicalData = 'ASPSMT',
  [string]$LogicalLog  = 'ASPSMT_log'
)
# Clone a throwaway database for migration rehearsal.
# BACKUP (COPY_ONLY, source untouched) + RESTORE ... WITH MOVE.
#
# PURE ASCII ON PURPOSE: PowerShell 5.1 reads a .ps1 without a BOM as ANSI,
# so non-ASCII comments/strings turn into mojibake and can break parsing
# (same rule as the .bat files - see deploy/部署说明.md section 7).
#
# The logical file names inside the backup are ASPSMT / ASPSMT_log regardless
# of the database name (legacy HSDZ naming) - do not assume they match $Source.
$ErrorActionPreference = 'Stop'
$bak = Join-Path $env:TEMP "$Target-$(Get-Date -Format yyyyMMdd-HHmmss).bak"

Write-Host "== backup $Source -> $bak"
sqlcmd -S localhost -E -b -Q "BACKUP DATABASE [$Source] TO DISK = N'$bak' WITH FORMAT, INIT, COPY_ONLY;"
if ($LASTEXITCODE -ne 0) { throw "BACKUP failed" }

$sql = @"
IF DB_ID(N'$Target') IS NOT NULL
BEGIN
  ALTER DATABASE [$Target] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [$Target];
END
DECLARE @data NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @log  NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultLogPath')  AS NVARCHAR(400));
DECLARE @s NVARCHAR(MAX) = N'RESTORE DATABASE [$Target] FROM DISK = N''$bak'' WITH RECOVERY, '
  + N'MOVE N''$LogicalData'' TO ''' + @data + N'$Target.mdf'', '
  + N'MOVE N''$LogicalLog''  TO ''' + @log  + N'$Target_log.ldf''';
EXEC(@s);
PRINT N'RESTORED $Target';
"@
Write-Host "== restore as $Target"
sqlcmd -S localhost -E -b -Q $sql
if ($LASTEXITCODE -ne 0) { throw "RESTORE failed" }

Write-Host "== verify"
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT name + ' = ' + state_desc FROM sys.databases WHERE name IN (N'$Source', N'$Target');"
Write-Host "OK: clone $Target ready"
