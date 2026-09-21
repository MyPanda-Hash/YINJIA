# assemble-incr-pkg.ps1 - build the incremental deployment package folder.
# PURE ASCII ON PURPOSE (PowerShell 5.1 reads a BOM-less .ps1 as ANSI).
#
# 2026-09-21: Copy-Item silently skipped one of 161 script copies during a bulk
# run while the loop still counted it as copied - the package shipped 160/161 and
# the migration runner then hard-failed on a "missing file". Every copy is now
# verified on disk, and the script refuses to report success on any mismatch.
$ErrorActionPreference = 'Stop'
$root  = 'C:\INCER\YINJIA-MES'
$pkg   = Join-Path $root 'deploy\pkg-incr-20260921'
$tools = Join-Path $pkg 'tools'
$lib   = Join-Path $tools 'lib'
$problems = New-Object System.Collections.ArrayList

New-Item -ItemType Directory -Force -Path $lib | Out-Null

function Copy-Verified {
  param([string]$From, [string]$To)
  if (-not (Test-Path $From)) { [void]$problems.Add("SOURCE MISSING: $From"); return $false }
  Copy-Item -LiteralPath $From -Destination $To -Force -ErrorAction Stop
  if (-not (Test-Path -LiteralPath $To)) { [void]$problems.Add("COPY NOT ON DISK: $To"); return $false }
  $a = (Get-Item -LiteralPath $From).Length
  $b = (Get-Item -LiteralPath $To).Length
  if ($a -ne $b) { [void]$problems.Add("SIZE MISMATCH ($a vs $b): $To"); return $false }
  return $true
}

# 1) app.jar
if (Copy-Verified (Join-Path $root 'deploy\app.jar') (Join-Path $pkg 'app.jar')) {
  Write-Host ("   app.jar copied ({0:N1} MB)" -f ((Get-Item (Join-Path $pkg 'app.jar')).Length / 1MB))
}

# 2) manifest + every script it lists, verified one by one
Copy-Verified (Join-Path $root 'tools\db-migrations.txt') (Join-Path $tools 'db-migrations.txt') | Out-Null
$manifest = Get-Content (Join-Path $root 'tools\db-migrations.txt') |
  Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' } |
  ForEach-Object { $_.Trim() }
# The manifest legitimately repeats a few scripts (they were registered again on
# later dates). DbSync reads it in order, so duplicates are harmless there - but a
# raw count against the package overstates how many distinct files must exist.
$distinct = @($manifest | Sort-Object -Unique)

$okCount = 0
foreach ($s in $distinct) {
  if (Copy-Verified (Join-Path $root "tools\$s") (Join-Path $tools $s)) { $okCount++ }
}
Write-Host "   migration scripts verified: $okCount / $($distinct.Count) distinct  (manifest holds $($manifest.Count) entries)"
if ($okCount -ne $distinct.Count) { [void]$problems.Add("SCRIPT COUNT $okCount <> $($distinct.Count) distinct") }

# 3) toolchain + driver
Copy-Verified (Join-Path $root 'tools\DbSync.java') (Join-Path $tools 'DbSync.java') | Out-Null
Copy-Verified (Join-Path $root 'tools\lib\mssql-jdbc.jar') (Join-Path $lib 'mssql-jdbc.jar') | Out-Null
Write-Host "   DbSync.java + mssql-jdbc.jar verified"

# 4) login probe
Copy-Verified (Join-Path $root 'deploy\probe-login.ps1') (Join-Path $pkg 'probe-login.ps1') | Out-Null
Write-Host "   probe-login.ps1 verified"

# 5) HARD GATE: package tools\*.sql must equal the manifest's distinct script set
$absent = @($distinct | Where-Object { -not (Test-Path (Join-Path $tools $_)) })
if ($absent.Count -gt 0) {
  Write-Host "   *** $($absent.Count) MANIFEST SCRIPT(S) ABSENT FROM PACKAGE ***"
  $absent | ForEach-Object { Write-Host "       $_" }
  [void]$problems.Add("ABSENT: $($absent.Count) scripts")
}
# anything in tools\ that the manifest does not list is dead weight: DbSync never
# reads it, so it would only ever mislead whoever inspects the package
$pkgSql = @(Get-ChildItem $tools -Filter '*.sql' -File | ForEach-Object { $_.Name } | Sort-Object)
$extra  = @(Compare-Object -ReferenceObject $distinct -DifferenceObject $pkgSql -PassThru |
            Where-Object { $_.SideIndicator -eq '=>' })
if ($extra.Count -gt 0) {
  Write-Host "   *** $($extra.Count) SCRIPT(S) IN PACKAGE BUT NOT IN MANIFEST ***"
  $extra | ForEach-Object { Write-Host "       $_" }
  [void]$problems.Add("EXTRA: $($extra.Count) scripts not in manifest")
}
Write-Host "   package tools\*.sql = $($pkgSql.Count), manifest distinct = $($distinct.Count), exact match = $($absent.Count -eq 0 -and $extra.Count -eq 0)"

# 6) ASCII + CRLF gate on the .bat files (zh-CN cmd parses them as GBK; bare LF breaks them)
foreach ($batName in @('deploy-incremental.bat','apply-migrations.bat','check-migrations.bat')) {
  $bp = Join-Path $pkg $batName
  if (-not (Test-Path $bp)) { [void]$problems.Add("BAT MISSING: $batName"); continue }
  $raw = [System.IO.File]::ReadAllText($bp)
  $nonAscii = @($raw.ToCharArray() | Where-Object { [int]$_ -gt 126 -and [int]$_ -ne 13 -and [int]$_ -ne 10 })
  $bareLF = [regex]::IsMatch($raw, "(?<!`r)`n")
  if ($nonAscii.Count -gt 0) { [void]$problems.Add("BAT NON-ASCII x$($nonAscii.Count): $batName") }
  if ($bareLF) { [void]$problems.Add("BAT HAS BARE LF: $batName") }
  Write-Host ("   {0}: ascii={1} crlf={2}" -f $batName, ($nonAscii.Count -eq 0), (-not $bareLF))
}

# 7) integrity manifest
$files = Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' }
$lines = foreach ($f in $files) {
  $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
  "$h  $($f.FullName.Substring($pkg.Length + 1))"
}
$lines | Set-Content (Join-Path $pkg 'SHA256SUMS.txt') -Encoding ASCII
Write-Host "   SHA256SUMS.txt written ($($lines.Count) files)"

# 8) verdict
Write-Host ""
if ($problems.Count -gt 0) {
  Write-Host "RESULT: FAIL-ASSEMBLY"
  $problems | ForEach-Object { Write-Host "   - $_" }
  exit 1
}
Write-Host "RESULT: ASSEMBLY-OK"
Get-ChildItem $pkg | Select-Object Mode, Length, Name | Format-Table -AutoSize
