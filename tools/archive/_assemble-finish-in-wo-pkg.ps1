# _assemble-finish-in-wo-pkg.ps1 —— 组装「产成品入库单加工单号补齐」服务器包（2026-10-22）
#
# 产物：deploy\incr-finish-in-wo-backfill-20261022\（可运行）+ deploy\incr-finish-in-wo-backfill-20261022.zip
# 包里的 tools\*.sql / verify\ / SqlRunner / jdbc 都是派生物：每次从仓库真源重建并校验字节数，
# 最后写 SHA256SUMS.txt —— 服务器上先校验再执行。
#
# 用法（仓库根）：
#   powershell -ExecutionPolicy Bypass -File tools\archive\_assemble-finish-in-wo-pkg.ps1
param(
    [string]$PkgName = 'incr-finish-in-wo-backfill-20261022'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pkg  = Join-Path $root "deploy\$PkgName"
$problems = New-Object System.Collections.ArrayList

function Copy-Verified {
    param([string]$From, [string]$To)
    if (-not (Test-Path -LiteralPath $From)) { [void]$problems.Add("SOURCE MISSING: $From"); return $false }
    $dir = Split-Path -Parent $To
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Copy-Item -LiteralPath $From -Destination $To -Force
    if (-not (Test-Path -LiteralPath $To)) { [void]$problems.Add("COPY NOT ON DISK: $To"); return $false }
    if ((Get-Item -LiteralPath $From).Length -ne (Get-Item -LiteralPath $To).Length) {
        [void]$problems.Add("SIZE MISMATCH: $To"); return $false
    }
    return $true
}

Write-Host "[1/4] 清空派生物目录（保留 apply.ps1 / rollback.ps1 / README）"
foreach ($d in @('tools', 'verify', 'logs')) {
    $p = Join-Path $pkg $d
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path (Join-Path $pkg 'tools\lib') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $pkg 'verify') | Out-Null

Write-Host "[2/4] 拷 SQL 与执行器"
$map = @(
    @{ From = 'tools\verify\finish-in-wo-preflight.sql';                  To = 'tools\finish-in-wo-preflight.sql' },
    @{ From = 'tools\verify\finish-in-wo-summary.sql';                    To = 'tools\finish-in-wo-summary.sql' },
    @{ From = 'tools\migrate-finish-in-wo-backfill-20261022.sql';         To = 'tools\migrate-finish-in-wo-backfill-20261022.sql' },
    @{ From = 'tools\migrate-finish-in-wo-backfill-full-20261022.sql';    To = 'tools\migrate-finish-in-wo-backfill-full-20261022.sql' },
    @{ From = 'tools\rollback-finish-in-wo-backfill-20261022.sql';        To = 'tools\rollback-finish-in-wo-backfill-20261022.sql' },
    @{ From = 'tools\SqlRunner.java';                                     To = 'tools\SqlRunner.java' },
    @{ From = 'tools\lib\mssql-jdbc.jar';                                 To = 'tools\lib\mssql-jdbc.jar' },
    @{ From = 'tools\verify\finish-in-wo-backfill-report.sql';            To = 'verify\finish-in-wo-backfill-report.sql' }
)
foreach ($m in $map) {
    if (Copy-Verified (Join-Path $root $m.From) (Join-Path $pkg $m.To)) {
        Write-Host ("   ok  {0}" -f $m.To)
    }
}

Write-Host "[3/4] 检查脚本自带的口径标记（防止拷错版本）"
$full = Get-Content -LiteralPath (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-full-20261022.sql') -Raw
if ($full -notmatch 'FINISH-IN-WO-FULL-') { [void]$problems.Add('FULL SCRIPT LACKS RESULT MARKER') }
$strict = Get-Content -LiteralPath (Join-Path $pkg 'tools\migrate-finish-in-wo-backfill-20261022.sql') -Raw
if ($strict -notmatch 'FINISH-IN-WO-FILLED-') { [void]$problems.Add('STRICT SCRIPT LACKS RESULT MARKER') }
$rb = Get-Content -LiteralPath (Join-Path $pkg 'tools\rollback-finish-in-wo-backfill-20261022.sql') -Raw
if ($rb -notmatch 'FINISH-IN-WO-ROLLED-BACK-') { [void]$problems.Add('ROLLBACK SCRIPT LACKS RESULT MARKER') }
if ($problems.Count -eq 0) { Write-Host '   markers ok' }

Write-Host "[4/4] SHA256SUMS.txt + zip"
$sums = Join-Path $pkg 'SHA256SUMS.txt'
if (Test-Path $sums) { Remove-Item $sums -Force }
$lines = foreach ($f in (Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' -and $_.FullName -notmatch '\\logs\\' })) {
    $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
    "$h  $($f.FullName.Substring($pkg.Length + 1))"
}
$lines | Set-Content -LiteralPath $sums -Encoding ASCII
Write-Host ("   {0} files checksummed" -f $lines.Count)

$zip = Join-Path $root ("deploy\{0}.zip" -f $PkgName)
if (Test-Path $zip) { Remove-Item $zip -Force }
$items = Get-ChildItem $pkg -Force | Where-Object { $_.Name -ne 'logs' } | ForEach-Object { $_.FullName }
Compress-Archive -Path $items -DestinationPath $zip -CompressionLevel Optimal
Write-Host ("   {0}  ({1} MB)" -f $zip, [math]::Round((Get-Item $zip).Length / 1MB, 2))

Write-Host ''
if ($problems.Count -gt 0) {
    Write-Host 'RESULT: FAIL-ASSEMBLY'
    $problems | ForEach-Object { Write-Host "   - $_" }
    exit 1
}
Write-Host 'RESULT: ASSEMBLY-OK'
Get-ChildItem $pkg | Select-Object Mode, Length, Name | Format-Table -AutoSize
