# _assemble-asm-bom-full-pkg.ps1 —— 组装「组装物料清单(ASM_BOM)全量导入」一次性包(2026-11-05)
#
# 产物:deploy\incr-asm-bom-full-20261105\(可運行包) + deploy\incr-asm-bom-full-20261105.zip
# 为什么要有这个脚本:包里的 SQL 副本 / tools\(DbSync.java + mssql-jdbc.jar + 最小清单)/
#   SHA256SUMS.txt 都是**派生物**,由本脚本每次从仓库真源重建并逐字节校验,避免"手拷漏文件、
#   说不清这份包对的是哪次提交"。README-AI.md / apply.bat / check.bat / CHECK-after.sql 是源文件,不入派生清理。
#
# 用法(仓库根):
#   powershell -ExecutionPolicy Bypass -File tools\archive\_assemble-asm-bom-full-pkg.ps1
#
# 注意:apply.bat / check.bat 必须 ASCII + CRLF(本脚本会校验,防止 UTF-8 中文被 cmd.exe 撕碎)。
param(
    [string]$PkgName = 'incr-asm-bom-full-20261105',
    [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pkg  = Join-Path $root "deploy\$PkgName"
$problems = New-Object System.Collections.ArrayList

function Add-Problem([string]$msg) { [void]$problems.Add($msg) }

function Copy-Verified {
    param([string]$From, [string]$To)
    if (-not (Test-Path -LiteralPath $From)) { Add-Problem "SOURCE MISSING: $From"; return $false }
    $dir = Split-Path -Parent $To
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Copy-Item -LiteralPath $From -Destination $To -Force
    if (-not (Test-Path -LiteralPath $To)) { Add-Problem "COPY NOT ON DISK: $To"; return $false }
    $a = (Get-FileHash -LiteralPath $From -Algorithm SHA256).Hash
    $b = (Get-FileHash -LiteralPath $To -Algorithm SHA256).Hash
    if ($a -ne $b) { Add-Problem "SHA256 MISMATCH: $From -> $To"; return $false }
    return $true
}

Write-Host "[1/6] 清空派生物(SQL 副本 / tools\ / SHA256SUMS.txt / logs / zip),保留源文件"
foreach ($f in @('migrate-asm-bom-data-full-20261105.sql', 'SHA256SUMS.txt')) {
    $p = Join-Path $pkg $f
    if (Test-Path $p) { Remove-Item -LiteralPath $p -Force }
}
foreach ($d in @('tools', 'logs')) {
    $p = Join-Path $pkg $d
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}
if (-not (Test-Path $pkg)) { Add-Problem "PKG DIR MISSING: $pkg" }
New-Item -ItemType Directory -Force -Path (Join-Path $pkg 'tools\lib') | Out-Null

Write-Host "[2/6] 校验源文件存在"
$required = @('README-AI.md', 'apply.bat', 'check.bat', 'CHECK-after.sql')
foreach ($f in $required) {
    $p = Join-Path $pkg $f
    if (-not (Test-Path -LiteralPath $p)) { Add-Problem "PKG SOURCE MISSING: $f" }
}

Write-Host "[3/6] 拷派生物(SQL / DbSync.java / mssql-jdbc.jar)"
$map = @(
    @{ From = 'tools\migrate-asm-bom-data-full-20261105.sql'; To = 'migrate-asm-bom-data-full-20261105.sql' },
    @{ From = 'tools\DbSync.java';                            To = 'tools\DbSync.java' },
    @{ From = 'tools\lib\mssql-jdbc.jar';                     To = 'tools\lib\mssql-jdbc.jar' }
)
foreach ($m in $map) {
    if (Copy-Verified (Join-Path $root $m.From) (Join-Path $pkg $m.To)) {
        Write-Host ("   ok  {0}" -f $m.To)
    }
}

Write-Host "[4/6] 写 tools\db-migrations.txt(最小清单,仅供 DbSync run 启动时读取)"
$manifest = @(
    '# Minimal manifest used ONLY by DbSync "run" mode in this one-off package',
    '# (run mode does not consume the list; it only requires this file to exist).',
    '# The real migration list lives in the repository: tools/db-migrations.txt',
    '# and already contains this script.',
    'migrate-asm-bom-data-full-20261105.sql'
)
Set-Content -LiteralPath (Join-Path $pkg 'tools\db-migrations.txt') -Value $manifest -Encoding ASCII

Write-Host "[5/6] 校验 apply.bat / check.bat = ASCII + CRLF + 无控制字符"
foreach ($f in @('apply.bat', 'check.bat')) {
    $p = Join-Path $pkg $f
    if (-not (Test-Path -LiteralPath $p)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($p)
    $bad = @($bytes | Where-Object { $_ -gt 127 -or $_ -eq 7 -or $_ -eq 8 -or $_ -eq 9 -or $_ -eq 11 -or $_ -eq 12 })
    if ($bad.Count -gt 0) { Add-Problem "$f NOT ASCII-CLEAN ($($bad.Count) bad bytes)" }
    $lf = 0; $crlf = 0
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        if ($bytes[$i] -eq 10) {
            $lf++
            if ($i -gt 0 -and $bytes[$i - 1] -eq 13) { $crlf++ }
        }
    }
    if ($lf -ne $crlf) { Add-Problem "$f HAS BARE LF ($($lf - $crlf) lines)" }
    Write-Host ("   ok  {0}: {1} bytes, ASCII, CRLF x{2}" -f $f, $bytes.Length, $crlf)
}

Write-Host "[6/6] 写 SHA256SUMS.txt 并压 zip"
$sums = New-Object System.Collections.ArrayList
$sumFiles = @('apply.bat', 'check.bat', 'CHECK-after.sql', 'README-AI.md',
              'migrate-asm-bom-data-full-20261105.sql',
              'tools\DbSync.java', 'tools\db-migrations.txt', 'tools\lib\mssql-jdbc.jar')
foreach ($rel in $sumFiles) {
    $p = Join-Path $pkg $rel
    if (-not (Test-Path -LiteralPath $p)) { Add-Problem "SUM TARGET MISSING: $rel"; continue }
    $hash = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower()
    [void]$sums.Add(("{0} *{1}" -f $hash, $rel.Replace('\','/')))
}
Set-Content -LiteralPath (Join-Path $pkg 'SHA256SUMS.txt') -Value $sums -Encoding ASCII
Write-Host ("   ok  SHA256SUMS.txt ({0} files)" -f $sums.Count)

if (-not $SkipZip) {
    $zip = Join-Path $root "deploy\$PkgName.zip"
    if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
    $zipStream = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
    try {
        $zipFiles = Get-ChildItem -LiteralPath $pkg -Recurse -File | Sort-Object FullName
        foreach ($f in $zipFiles) {
            $rel = $f.FullName.Substring($pkg.Length + 1).Replace('\', '/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipStream, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
        }
    } finally { $zipStream.Dispose() }
    $z = Get-Item -LiteralPath $zip
    Write-Host ("   ok  {0} ({1} bytes, {2} entries, forward-slash names)" -f $z.Name, $z.Length, $zipFiles.Count)
}

Write-Host ''
if ($problems.Count -gt 0) {
    Write-Host "RESULT: PKG-FAIL"
    $problems | ForEach-Object { Write-Host ("  - {0}" -f $_) }
    exit 1
}
Write-Host "RESULT: PKG-OK  -> $pkg"
