# _assemble-prod-pick-outh-pkg.ps1 —— 组装「生产领料」增量包（2026-10-22）
#
# 产物：deploy\incr-prod-pick-outh-20261022\（可运行的全量包）+ deploy\incr-prod-pick-outh-20261022.zip
# 为什么要有这个脚本：包里的 tools\*.sql / static\ / verify\ 都是**派生物**，
#   手拷容易漏文件、也说不清"这份包对的是哪次提交"。脚本每次从仓库真源重建，
#   并逐项校验字节数，最后写 SHA256SUMS.txt —— 服务器上先跑校验再执行。
#
# 用法（仓库根）：
#   powershell -ExecutionPolicy Bypass -File tools\archive\_assemble-prod-pick-outh-pkg.ps1
#
# 前置：backend\src\main\resources\static 必须是**最新构建**
#   （build-appjar.ps1 -SkipFrontend 会做 dist->static 的镜像同步；纯前端改动用
#    npm run build + robocopy 也行）。本脚本只做镜像，不跑构建。
param(
    [string]$PkgName = 'incr-prod-pick-outh-20261022'
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
    $a = (Get-Item -LiteralPath $From).Length
    $b = (Get-Item -LiteralPath $To).Length
    if ($a -ne $b) { [void]$problems.Add("SIZE MISMATCH ($a vs $b): $To"); return $false }
    return $true
}

Write-Host "[1/5] 清空派生物目录（保留 apply.ps1 / rollback.ps1 / README / SHA256SUMS）"
foreach ($d in @('tools', 'static', 'verify', 'logs')) {
    $p = Join-Path $pkg $d
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path (Join-Path $pkg 'tools\lib') | Out-Null

Write-Host "[2/5] 拷 SQL 与执行器"
$map = @(
    @{ From = 'tools\migrate-prod-pick-outh-20261022.sql';  To = 'tools\migrate-prod-pick-outh-20261022.sql' },
    @{ From = 'tools\verify\prod-pick-preflight.sql';       To = 'tools\prod-pick-preflight.sql' },
    @{ From = 'tools\verify\verify-prod-pick-outh.sql';     To = 'tools\verify-prod-pick-outh.sql' },
    @{ From = 'tools\rollback-prod-pick-outh-20261022.sql'; To = 'tools\rollback-prod-pick-outh-20261022.sql' },
    @{ From = 'tools\SqlRunner.java';                       To = 'tools\SqlRunner.java' },
    @{ From = 'tools\lib\mssql-jdbc.jar';                   To = 'tools\lib\mssql-jdbc.jar' },
    @{ From = 'tools\verify\prod-pick-outh-e2e.mjs';        To = 'verify\prod-pick-outh-e2e.mjs' }
)
foreach ($m in $map) {
    if (Copy-Verified (Join-Path $root $m.From) (Join-Path $pkg $m.To)) {
        Write-Host ("   ok  {0}" -f $m.To)
    }
}

Write-Host "[3/5] 镜像前端产物 static\"
$static = Join-Path $pkg 'static'
New-Item -ItemType Directory -Force -Path $static | Out-Null
$staticSrc = Join-Path $root 'backend\src\main\resources\static'
if (-not (Test-Path (Join-Path $staticSrc 'index.html'))) {
    [void]$problems.Add("STATIC MISSING: $staticSrc\index.html")
} else {
    robocopy $staticSrc $static /MIR /NFL /NDL /NJH /NJS /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { [void]$problems.Add("robocopy static failed ($LASTEXITCODE)") }
    $n = @(Get-ChildItem $static -Recurse -File).Count
    Write-Host "   static files: $n"
    # 菜单项必须真的在产物里，否则装完菜单是空的
    $hit = Select-String -Path (Join-Path $static 'assets\index-*.js') -Pattern 'PROD_PICK_LIST' -SimpleMatch -List
    if (-not $hit) { [void]$problems.Add('STATIC LACKS PROD_PICK_LIST MENU ENTRY') }
    else { Write-Host ("   menu entry found in {0}" -f (Split-Path -Leaf $hit.Path)) }
}

Write-Host "[4/5] SHA256SUMS.txt"
$sums = Join-Path $pkg 'SHA256SUMS.txt'
if (Test-Path $sums) { Remove-Item $sums -Force }
$lines = foreach ($f in (Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' -and $_.FullName -notmatch '\\logs\\' })) {
    $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
    "$h  $($f.FullName.Substring($pkg.Length + 1))"
}
$lines | Set-Content -LiteralPath $sums -Encoding ASCII
Write-Host ("   {0} files checksummed" -f $lines.Count)

Write-Host "[5/5] 打 zip"
$zip = Join-Path $root ("deploy\{0}.zip" -f $PkgName)
if (Test-Path $zip) { Remove-Item $zip -Force }
# 只装"包里该有的东西"：logs（运行时产物）不进包
$items = Get-ChildItem $pkg -Force | Where-Object { $_.Name -ne 'logs' } | ForEach-Object { $_.FullName }
Compress-Archive -Path $items -DestinationPath $zip -CompressionLevel Optimal
$zipMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host ("   {0}  ({1} MB)" -f $zip, $zipMb)

Write-Host ''
if ($problems.Count -gt 0) {
    Write-Host 'RESULT: FAIL-ASSEMBLY'
    $problems | ForEach-Object { Write-Host "   - $_" }
    exit 1
}
Write-Host 'RESULT: ASSEMBLY-OK'
Get-ChildItem $pkg | Select-Object Mode, Length, Name | Format-Table -AutoSize
