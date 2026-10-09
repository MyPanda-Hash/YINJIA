# _start-backend-nosync.ps1 — start the prod instance (8090) WITHOUT the DB sync step.
#
# Why this exists (one-off, 2026-10-06): tools\scripts\start-prod.ps1 runs tools\sync-db.bat first.
# The working tree currently carries ANOTHER task's in-flight migration edits
# (tools\db-migrations.txt + tools\migrate-qc-tc-*.sql / migrate-material-out-i18n.sql), and DbSync
# re-runs every script whose bytes changed -> starting via start-prod.ps1 would apply unvetted
# migrations. This task's change is Java-only, so the sync is not needed for verification.
# Everything else (JDK 25 gate, backend\.env injection, jar path, port) mirrors start-prod.ps1.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
$dir = Join-Path $root 'backend'

# --- JDK 25 gate (same policy as start-prod.ps1) ---
function Test-Jdk25([string]$jdkHome) {
  if (-not $jdkHome) { return $false }
  $rel = Join-Path $jdkHome 'release'
  $java = Join-Path $jdkHome 'bin\java.exe'
  if (-not (Test-Path $rel) -or -not (Test-Path $java)) { return $false }
  $line = Select-String -Path $rel -Pattern '^JAVA_VERSION="([0-9]+)' | Select-Object -First 1
  if (-not $line) { return $false }
  return ([int]$line.Matches[0].Groups[1].Value -ge 25)
}
$cands = @()
if ($env:JAVA_HOME) { $cands += $env:JAVA_HOME.TrimEnd('\') }
foreach ($d in @("$env:USERPROFILE\.jdks", 'C:\Program Files\Java', 'D:\Program Files\Java')) {
  if (Test-Path $d) { $cands += (Get-ChildItem -Path $d -Directory | ForEach-Object { $_.FullName }) }
}
$jdk = $cands | Where-Object { Test-Jdk25 $_ } | Select-Object -First 1
if (-not $jdk) { throw 'JDK 25+ not found (classes are major 69)' }
$env:JAVA_HOME = $jdk
$javaExe = Join-Path $jdk 'bin\java.exe'

# --- backend\.env injection (OCR / machine-translation keys) ---
$envFile = Join-Path $dir '.env'
$n = 0
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#') -or $t -notmatch '=') { continue }
    $kv = $t -split '=', 2
    [Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim(), 'Process')
    $n++
  }
}
Write-Host "JDK      : $jdk"
Write-Host "env vars : $n (from backend\.env)"
Write-Host "DB sync  : SKIPPED (see file header)"
$log = Join-Path $dir 'target\_start.log'
Start-Process -FilePath $javaExe -ArgumentList '-jar', 'target\yinjia-mes-backend-0.1.0.jar' `
  -WorkingDirectory $dir -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Write-Host "started (log: $log)"
