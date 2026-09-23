# _dryrun-restore.ps1 - dry-run deploy\restore-db.sql against a SCRATCH database (2026-09-21)
#
# WHY: that script DROPs a database and restores over it. Locally we rehearse it with
#   * the database name replaced by HSDZ_RESTORE_TEST (even if a guard fails, only the
#     scratch DB is harmed - the dev DB can never be touched), and
#   * two backup paths: a bogus one and the real packaged .bak.
# Variant A (backup missing) must print [STOP] and do NOTHING (no scratch DB created).
# Variant B (backup present) must really restore a database with the demo data intact.
# The scratch DB is dropped at the end.
#
# ASCII-ONLY ON PURPOSE (same rule as the .bat files): PowerShell 5.1 reads a .ps1
# without a BOM as ANSI, so non-ASCII comments/strings become mojibake and can break
# the parser (hit twice already). All Chinese lives in the .sql template, which is
# read explicitly as UTF-8.
#
# Usage: powershell -File tools/archive/_dryrun-restore.ps1
$ErrorActionPreference = 'Stop'
$repo = 'C:\INCER\YINJIA-MES'
$src = Join-Path $repo 'deploy\restore-db.sql'
$tpl = Join-Path $repo 'tools\archive\_dryrun-checks.template.sql'
$bakReal = Join-Path $repo 'deploy\pkg-20260921\HSDZ_MES.bak'
$bakBogus = Join-Path $repo 'deploy\_no_such_backup_.bak'
$scratch = 'HSDZ_RESTORE_TEST'
$connStr = 'Server=localhost;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=15'

function New-Conn {
  $c = New-Object System.Data.SqlClient.SqlConnection($connStr)
  $c.add_InfoMessage({ param($s, $e) Write-Host ("    [sql] " + $e.Message) })
  $c.Open(); return $c
}

function Run-Sql($c, $text, $label) {
  $i = 0; $err = 0
  foreach ($b in ($text -split "(?m)^\s*GO\s*$")) {
    $t = $b.Trim(); if ($t.Length -eq 0) { continue }
    $i++
    $cmd = $c.CreateCommand(); $cmd.CommandText = $t; $cmd.CommandTimeout = 1800
    try { $null = $cmd.ExecuteNonQuery() } catch { $err++; Write-Host ("  [{0}] batch {1} ERROR: {2}" -f $label, $i, $_.Exception.Message) }
  }
  Write-Host ("  [{0}] batches={1} errors={2}" -f $label, $i, $err)
  return $err
}

function Scalar($c, $sql) {
  $cmd = $c.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 300
  return $cmd.ExecuteScalar()
}

function Variant($bak) {
  # ORDER MATTERS: the backup path contains the literal text HSDZ_MES, so rename the
  # path to a sentinel FIRST, then rewrite the DB name everywhere, then put the real
  # path back. Doing it the other way round silently breaks variant B (the bogus/
  # scratch path survives and the guard stops a restore that should have run).
  $t = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)
  $t = $t.Replace('C:\yinjia\HSDZ_MES.bak', '@@BAKPATH@@')
  $t = $t.Replace('[HSDZ_MES]', "[$scratch]").Replace('HSDZ_MES', $scratch)
  $t = $t.Replace('@@BAKPATH@@', $bak)
  return $t
}

$c = New-Conn
Write-Output '=== before: scratch DB must not exist ==='
Write-Host ("  DB_ID({0}) = {1}" -f $scratch, (Scalar $c "SELECT CASE WHEN DB_ID('$scratch') IS NULL THEN 'NULL' ELSE 'EXISTS' END"))

Write-Output ''
Write-Output '=== variant A: backup path does not exist (guard must hard-stop) ==='
$cA = New-Conn; $errA = Run-Sql $cA (Variant $bakBogus) 'A'; $cA.Close(); $c = New-Conn
$afterA = Scalar $c "SELECT CASE WHEN DB_ID('$scratch') IS NULL THEN 'NULL' ELSE 'EXISTS' END"
Write-Host ("  after A: DB_ID = {0}   (expect NULL - the guard skipped everything)" -f $afterA)

Write-Output ''
Write-Output '=== variant B: backup present (must really restore) ==='
Write-Host ("  bak = {0} ({1} bytes)" -f $bakReal, (Get-Item $bakReal).Length)
$cB = New-Conn; $errB = Run-Sql $cB (Variant $bakReal) 'B'; $cB.Close()
$afterB = Scalar $c "SELECT CASE WHEN DB_ID('$scratch') IS NULL THEN 'NULL' ELSE 'EXISTS' END"
Write-Host ("  after B: DB_ID = {0}   (expect EXISTS)" -f $afterB)

if ($afterB -eq 'EXISTS') {
  Write-Output ''
  Write-Output '=== restored scratch DB content ==='
  $checks = [IO.File]::ReadAllText($tpl, [Text.Encoding]::UTF8).Replace('@@DB@@', $scratch)
  $cmd = $c.CreateCommand(); $cmd.CommandText = $checks; $cmd.CommandTimeout = 300
  $r = $cmd.ExecuteReader()
  while ($r.Read()) { Write-Host ("  {0,-18} = {1}" -f $r.GetString(0), $r.GetString(1)) }
  $r.Close()
}

Write-Output ''
Write-Output '=== cleanup: drop the scratch DB ==='
$cmd = $c.CreateCommand()
$cmd.CommandText = "IF DB_ID('$scratch') IS NOT NULL BEGIN ALTER DATABASE [$scratch] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$scratch]; END"
$null = $cmd.ExecuteNonQuery()
Write-Host ("  DB_ID({0}) = {1}" -f $scratch, (Scalar $c "SELECT CASE WHEN DB_ID('$scratch') IS NULL THEN 'NULL' ELSE 'EXISTS' END"))
Write-Host ("  dev DB untouched: DB_ID(HSDZ_MES) = {0}" -f (Scalar $c "SELECT ISNULL(CAST(DB_ID('HSDZ_MES') AS nvarchar(10)),'NULL')"))
$c.Close()
Write-Output ''
Write-Host ("summary: variant A errors={0}  variant B errors={1}" -f $errA, $errB)
