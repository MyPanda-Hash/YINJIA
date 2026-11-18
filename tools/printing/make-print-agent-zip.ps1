<#
  make-print-agent-zip.ps1 —— 打「客户电脑用」的打印代理分发包(2026-11-18)

  为什么要有这条命令:
    2026-11-18 核对发现 `deploy\yinjia-print-agent.zip` 还停在 2026-11-16(v1.1.0),
    而仓库里 `deploy\print-agent\print-agent.ps1` 已经是 v1.2.0(混料单纸表 / 无码也能出纸 /
    失败原因回传)。客户按 zip 装出来的还是老代理 ⇒「其他领料 / 其他退料 / 扫码混料 提交即打印」
    照样全失败 —— 与「客户那边用不了」是同一类事故:代码修了,包没跟上。
    所以把打包也变成一条可复跑命令:① 先过 PS2/Win7 兼容闸门(不过就不许打包);
    ② 按固定清单打 zip;③ 打完把 zip 里那份 print-agent.ps1 的版本号读回来核对。

  用法(开发机;Compress-Archive 需要 PowerShell 5+,客户电脑上不用跑这个):
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\printing\make-print-agent-zip.ps1
    ... -OutFile deploy\yinjia-print-agent.zip      # 默认就是它
    ... -SkipGate                                    # 只打包(不推荐)

  退出码:0 = 打包成功;1 = 失败(含闸门 FAIL / 缺文件)。
#>
param(
    [string]$Dir = '',
    [string]$OutFile = '',
    [switch]$SkipGate
)

$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$root = Split-Path -Parent (Split-Path -Parent $here)
if (-not $Dir) { $Dir = Join-Path (Join-Path $root 'deploy') 'print-agent' }
if (-not $OutFile) { $OutFile = Join-Path (Join-Path $root 'deploy') 'yinjia-print-agent.zip' }
$Dir = (Resolve-Path $Dir).Path

# 固定清单:客户电脑上要有的 13 个文件(配置/日志/PDF 一律不进包)
$Files = @(
    'print-agent.ps1', 'compat-ps2.ps1',
    '安装.ps1', '卸载.ps1', '安装.bat', '卸载.bat',
    'watchdog.ps1', 'watchdog-hidden.vbs', 'start-agent.ps1', '补启动.bat',
    'diagnose.ps1', '诊断.bat',
    '说明.md'
)

Write-Host ''
Write-Host '==== 打印代理分发包 ====' -ForegroundColor Cyan

# ── ① 兼容闸门:不过不打包 ────────────────────────────────────────────
if (-not $SkipGate) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here 'check-ps2-compat.ps1') -Dir $Dir
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[FAIL] PS2/Win7 兼容闸门没过,拒绝打包(客户那台 Win7 会踩)。' -ForegroundColor Red
        exit 1
    }
}

# ── ② 清单核对 ────────────────────────────────────────────────────
$missing = @()
foreach ($f in $Files) { if (-not (Test-Path (Join-Path $Dir $f))) { $missing += $f } }
if ($missing.Count -gt 0) {
    Write-Host ('[FAIL] 目录里缺文件: ' + ($missing -join ', ')) -ForegroundColor Red
    exit 1
}

$agentVer = ''
# 注意:版本正则必须放进**单引号**字符串 —— 双引号里的 $AgentVersion 会被 PowerShell 先插值成
# 1.2.0,正则就永远匹配不上(2026-11-18 实测踩到)。
$VerRe = '^\s*\$AgentVersion\s*=\s*''([^'']+)'''
foreach ($ln in (Get-Content -LiteralPath (Join-Path $Dir 'print-agent.ps1') -Encoding UTF8)) {
    if ($ln -match $VerRe) { $agentVer = $Matches[1] }
}
if (-not $agentVer) {
    Write-Host '[FAIL] 读不到 print-agent.ps1 的 $AgentVersion' -ForegroundColor Red
    exit 1
}
Write-Host ('[OK] 源目录版本: ' + $agentVer) -ForegroundColor Green

# ── ③ 打包(平铺,不带 print-out / 日志 / config)───────────────────
if (Test-Path $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
$paths = @()
foreach ($f in $Files) { $paths += (Join-Path $Dir $f) }
Compress-Archive -Path $paths -DestinationPath $OutFile -CompressionLevel Optimal -Force

# ── ④ 回读校验:包里的版本号 + 文件数 ──────────────────────────────
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($OutFile)
try {
    $names = @($zip.Entries | ForEach-Object { $_.Name })
    $entry = $zip.Entries | Where-Object { $_.Name -eq 'print-agent.ps1' }
    $tmp = Join-Path $env:TEMP ('pa-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.ps1')
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $tmp, $true)
    $inner = ''
    foreach ($ln in (Get-Content -LiteralPath $tmp -Encoding UTF8)) {
        if ($ln -match $VerRe) { $inner = $Matches[1] }
    }
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue

    Write-Host ''
    Write-Host ('包内容(' + $names.Count + ' 个):') -ForegroundColor Cyan
    foreach ($n in ($names | Sort-Object)) { Write-Host ('    ' + $n) }
    if ($inner -ne $agentVer) {
        Write-Host ('[FAIL] 包里的代理版本 ' + $inner + ' ≠ 源目录 ' + $agentVer) -ForegroundColor Red
        exit 1
    }
    $sizeKb = [Math]::Round((Get-Item $OutFile).Length / 1024, 1)
    Write-Host ''
    Write-Host ('[OK] 已生成 ' + $OutFile) -ForegroundColor Green
    Write-Host ('     版本 ' + $inner + ',共 ' + $names.Count + ' 个文件,' + $sizeKb + ' KB') -ForegroundColor Green
    Write-Host '     发客户前照 说明.md §十四:整包覆盖 + 双击「补启动.bat」按 R 重启代理' -ForegroundColor DarkGray
} finally {
    $zip.Dispose()
}
exit 0
