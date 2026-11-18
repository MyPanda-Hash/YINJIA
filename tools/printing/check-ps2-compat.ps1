<#
  check-ps2-compat.ps1 —— 打印代理「Windows 7 + PowerShell 2.0」兼容闸门(2026-11-18)

  为什么要有这个闸门:
    2026-11-10 做过一轮 Win7/PS2 适配(compat-ps2.ps1 + Say + .NET 打印机枚举,
    见 tools/archive/_print-agent-win7-20261110/README.md)。之后 11-16 加守护/诊断、
    11-18 加混料单纸表时,又写进了 PowerShell 3.0 才有 `Get-Content -Tail` —— 正好落在
    「诊断.bat」和「安装失败打印日志」这两条最需要证据的路径上,客户那台 Win7 上就是
    「找不到与参数名称 Tail 匹配的参数」。适配不是一次性的事,所以把它变成可复跑的闸门:
    **改完打印代理,发版前跑一遍,全 [OK] 才发。**

  用法(开发机,任意 PowerShell 都能跑;本脚本自身也是 PS2 安全写法):
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\printing\check-ps2-compat.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\printing\check-ps2-compat.ps1 -Dir deploy\print-agent

  退出码:0 = 全部通过(可能有 WARN);1 = 有 [FAIL]。

  已核实、**不要**误报的两处:
    · `Read-Host -AsSecureString` —— 客户那台 PS2 上实测可用(2026-11-10 现场 install.log
      已经跑到「正在验证服务器与账号」,说明密码那一步绑参成功)。
    · `Add-Type -AssemblyName System.Web.Extensions` —— .NET 3.5 自带,Win7 默认有。
#>
param(
    [string]$Dir = ''
)

$ErrorActionPreference = 'Continue'

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $Dir) {
    # tools\printing → repo 根 → deploy\print-agent
    $root = Split-Path -Parent (Split-Path -Parent $here)
    $Dir = Join-Path (Join-Path $root 'deploy') 'print-agent'
}
if (-not (Test-Path $Dir)) {
    Write-Host ("[FAIL] 目录不存在: " + $Dir) -ForegroundColor Red
    exit 1
}
$Dir = (Resolve-Path $Dir).Path

$script:Fail = 0
$script:Warn = 0

function Ok { param([string]$T) Write-Host ('[OK]   ' + $T) -ForegroundColor Green }
function Bad { param([string]$T) Write-Host ('[FAIL] ' + $T) -ForegroundColor Red; $script:Fail = $script:Fail + 1 }
function Warn { param([string]$T) Write-Host ('[WARN] ' + $T) -ForegroundColor Yellow; $script:Warn = $script:Warn + 1 }

# ── ① 只有 PowerShell 3.0+/Win8+ 才有的命令与参数(命中 = 客户那台 Win7 直接报错)───
#    注:检查前会剔除整行注释与 <# #> 块注释,所以注释里提到这些名字不会误报。
$Rules = @(
    @{ Id = 'PS3-GetContent-Tail';  Re = 'Get-Content[^\r\n]*\s-Tail\b';      Why = 'Get-Content -Tail 是 PowerShell 3.0 才加的(整读后取末 N 行)' },
    @{ Id = 'PS3-GetContent-Raw';   Re = 'Get-Content[^\r\n]*\s-Raw\b';       Why = 'Get-Content -Raw 是 PowerShell 3.0 才加的(-join [System.IO.File]::ReadAllLines)' },
    @{ Id = 'PS3-GetChildItem-File'; Re = 'Get-ChildItem[^\r\n]*\s-(File|Directory)\b'; Why = '-File / -Directory 是 PowerShell 3.0 才加的' },
    @{ Id = 'PS3-PSCustomObject';   Re = '\[pscustomobject\]';               Why = '[pscustomobject] 是 PowerShell 3.0 才加的(用 New-Object PSObject -Property)' },
    @{ Id = 'PS3-in-operator';      Re = '(?<![-\w])-(in|notin)\b';          Why = '-in / -notin 是 PowerShell 3.0 才加的(用 -contains)' },
    @{ Id = 'PS3-UsingScope';       Re = '\$using:';                         Why = '$using: 是 PowerShell 3.0 才加的(Start-Job 用 -ArgumentList 传参)' },
    @{ Id = 'PS3-GetCimInstance';   Re = 'Get-CimInstance';                  Why = 'Get-CimInstance 是 PowerShell 3.0 才加的(用 Get-WmiObject)' },
    @{ Id = 'Win8-GetPrinter';      Re = '\bGet-Printer\b';                  Why = 'Get-Printer 属 PrintManagement,Win8/2012 才有(用 .NET InstalledPrinters)' },
    @{ Id = 'PS3-ScheduledTask';    Re = '\b(Register|Unregister|Get|New|Set|Start|Stop)-(ScheduledTask|ScheduledTaskAction|ScheduledTaskTrigger|ScheduledTaskSettingsSet)\b'; Why = 'ScheduledTask 系列是 Win8/PS3 才有(用 schtasks.exe)' },
    @{ Id = 'PS3-OtherCmdlets';     Re = '\b(Get-FileHash|Get-ItemPropertyValue|New-TemporaryFile|Compress-Archive|Expand-Archive|Get-Volume|Test-NetConnection|Get-NetTCPConnection|Get-NetAdapter|Get-BitLockerVolume|Clear-RecycleBin|ConvertFrom-String)\b'; Why = '这些命令 PowerShell 2.0 没有' },
    @{ Id = 'PS5-ClassNew';         Re = '::new\s*\(';                       Why = '::new() 是 PowerShell 5 才加的(用 New-Object)' },
    @{ Id = 'PS4-CollectionMethod'; Re = '\.(ForEach|Where)\s*\(\s*\{';      Why = '集合方法 .ForEach{} / .Where{} 是 PowerShell 4 才加的' },
    @{ Id = 'PS5-NoNewline';        Re = '\s-NoNewline\b';                   Why = '-NoNewline 是 PowerShell 5 才加的' }
)

# ── ② 结构性检查 ──────────────────────────────────────────────────────
#    compat 提供的命令(ConvertFrom/To-Json、Invoke-WebRequest)必须:① 本文件引用了
#    compat-ps2.ps1;② 在 dot-source 之后才使用(行号更大)。
$CompatRe = '\b(ConvertFrom-Json|ConvertTo-Json|Invoke-WebRequest|Invoke-RestMethod)\b'
#    必须在 try 里(否则 PS2 上会抛:Win7 的 CLR 2.0 不认识 Tls12 / 没有 EscapeDataString)
$GuardedApis = @(
    @{ Re = '::Tls12';            Why = '[Net.SecurityProtocolType]::Tls12 在 .NET 2.0/3.5 上不存在,必须包在 try 里' },
    @{ Re = 'EscapeDataString';   Why = '[uri]::EscapeDataString 在 Win7 的 CLR 2.0 上不一定有,必须包在 try 里' }
)

$PsFiles = @(Get-ChildItem -Path $Dir -Filter '*.ps1' | Sort-Object Name)
$BatFiles = @(Get-ChildItem -Path $Dir -Filter '*.bat' | Sort-Object Name)

Write-Host ''
Write-Host ('==== 打印代理 PS2/Win7 兼容闸门  ' + $Dir + ' ====') -ForegroundColor Cyan
Write-Host ('     .ps1 ' + $PsFiles.Count + ' 个, .bat ' + $BatFiles.Count + ' 个;规则 ' + $Rules.Count + ' 条') -ForegroundColor Cyan
Write-Host ''

foreach ($f in $PsFiles) {
    $path = $f.FullName
    $fileIssues = 0

    # ── BOM:PowerShell 5.1/2.0 读脚本按本地代码页 ⇒ 无 BOM 的中文 .ps1 直接 39 个解析错误 ──
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191)) {
        Bad ($f.Name + ': 缺少 UTF-8 BOM —— Win7 的 PowerShell 按 GBK 读,中文会变乱码/解析报错')
        $fileIssues = $fileIssues + 1
    }

    $lines = @(Get-Content -LiteralPath $path -Encoding UTF8)
    $codeLines = @()
    $inBlock = $false
    $n = 0
    foreach ($ln in $lines) {
        $n = $n + 1
        $t = [string]$ln
        if ($inBlock) {
            if ($t -match '#>') { $inBlock = $false }
            continue
        }
        if ($t -match '<#') {
            if (-not ($t -match '#>')) { $inBlock = $true }
            continue
        }
        if ($t.TrimStart().StartsWith('#')) { continue }
        $codeLines = $codeLines + (New-Object PSObject -Property @{ No = $n; Text = $t })
    }

    # ── 规则扫描 ──
    foreach ($r in $Rules) {
        foreach ($c in $codeLines) {
            if ($c.Text -match $r.Re) {
                $snippet = $c.Text.Trim()
                if ($snippet.Length -gt 96) { $snippet = $snippet.Substring(0, 96) + '…' }
                Bad ($f.Name + ':' + $c.No + '  [' + $r.Id + '] ' + $r.Why)
                Write-Host ('          ' + $snippet) -ForegroundColor DarkGray
                $fileIssues = $fileIssues + 1
            }
        }
    }

    # ── compat:用了 ConvertFrom/To-Json、Invoke-WebRequest 就必须加载兼容层(自身除外)──
    if ($f.Name -ne 'compat-ps2.ps1') {
        $compatLine = -1
        $firstUse = -1
        foreach ($c in $codeLines) {
            if ($compatLine -lt 0 -and $c.Text -match 'compat-ps2\.ps1') { $compatLine = $c.No }
            if ($firstUse -lt 0 -and $c.Text -match $CompatRe) { $firstUse = $c.No }
        }
        if ($firstUse -gt 0 -and $compatLine -lt 0) {
            Bad ($f.Name + ': 用了 ConvertFrom/To-Json 或 Invoke-WebRequest,但没引用 compat-ps2.ps1(Win7 上这些命令不存在)')
            $fileIssues = $fileIssues + 1
        }
        if ($firstUse -gt 0 -and $compatLine -gt 0 -and $compatLine -gt $firstUse) {
            Bad ($f.Name + ': compat-ps2.ps1 在第 ' + $compatLine + ' 行才加载,但第 ' + $firstUse + ' 行就已经在用了(必须先加载)')
            $fileIssues = $fileIssues + 1
        }
    }

    # ── 必须在 try 里的 API(Tls12 / EscapeDataString)──
    foreach ($g in $GuardedApis) {
        $prev = ''
        foreach ($c in $codeLines) {
            if ($c.Text -match $g.Re) {
                $sameLineTry = $c.Text -match '\btry\b'
                if (-not $sameLineTry -and -not ($prev -match '\btry\b')) {
                    Bad ($f.Name + ':' + $c.No + '  ' + $g.Why)
                    $fileIssues = $fileIssues + 1
                }
            }
            $prev = $c.Text
        }
    }

    # ── WARN:$PSScriptRoot / $PSCommandPath 在 PS2 里不存在,必须有回退 ──
    if ($f.Name -ne 'compat-ps2.ps1') {
        $usesScriptRoot = $false
        $hasFallback = $false
        foreach ($c in $codeLines) {
            if ($c.Text -match '\$PSScriptRoot') { $usesScriptRoot = $true }
            if ($c.Text -match 'if\s*\(\s*\$PSScriptRoot') { $hasFallback = $true }
            if ($c.Text -match 'if\s*\(\s*\$PSCommandPath') { $hasFallback = $true }
        }
        if ($usesScriptRoot -and -not $hasFallback) {
            Warn ($f.Name + ': 用了 $PSScriptRoot 但没有 `if ($PSScriptRoot)` 回退(PS2 下它是空的)')
        }
    }

    if ($fileIssues -eq 0) { Ok ($f.Name + ': 通过') }
}

# ── .bat:Win7 控制台 + chcp 65001 = Write-Host 0x1F,安装第一行就断 ──
foreach ($b in $BatFiles) {
    $txt = [System.IO.File]::ReadAllText($b.FullName, [System.Text.Encoding]::Default)
    if ($txt -match 'chcp\s+65001') {
        Bad ($b.Name + ': 用了 chcp 65001 —— Win7 上 Write-Host 会报 0x1F,安装第一行就中断(改成 chcp 936)')
    }
    if ($txt -match 'chcp\s+936') { Ok ($b.Name + ': 用 chcp 936(中文正常)') }
}

Write-Host ''
if ($script:Fail -gt 0) {
    Write-Host ('==== 结果:FAIL —— ' + $script:Fail + ' 处不兼容(客户那台 Win7 会踩) ====') -ForegroundColor Red
    exit 1
}
Write-Host ('==== 结果:PASS —— 全部通过(WARN ' + $script:Warn + ' 条) ====') -ForegroundColor Green
exit 0
