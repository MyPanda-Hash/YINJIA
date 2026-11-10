# -*- coding: utf-8 -*-
# 一次性改造:让 print-agent 的安装/卸载/代理脚本在 Windows 7 + PowerShell 5.1 上可用
#  ① Write-Host → Say(控制台写不进去时退回 [Console]::Out / 日志,不再抛 0x1F)
#  ② Get-Printer(Win8+ 才有)→ .NET InstalledPrinters
#  ③ Get-CimInstance → Get-WmiObject / .NET(Win7 稳)
#  ④ 开 TLS1.2、检查 PS 版本、写 install.log
#  ⑤ .ps1 存 UTF-8 BOM;.bat 存 GBK(cp936),chcp 65001 → 936
param([string]$Root = 'D:\YINJIA-main\deploy\print-agent')

$ErrorActionPreference = 'Stop'
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
$gbk = [System.Text.Encoding]::GetEncoding(936)

function Get-CompatBlock([string]$logName) {
    $nl = "`r`n"
    return @(
        '',
        '# ── Win7 / 老 PowerShell 兼容(2026-11-10,现场 Win7 报 0x1F 后加)────────────────',
        '# 现场症状(Win7 + PS 5.1,安装窗口里):',
        '#   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F',
        '#                occurred when writing console output buffer at current cursor position.',
        '# 触发条件 = chcp 65001 + 某些 Win7 控制台/远程会话下控制台输出缓冲区不可写;Write-Host 一抛,',
        "# `$ErrorActionPreference='Stop' 就把安装打断。下面统一走 Say:",
        '#   先试带颜色 Write-Host → 失败退 [Console]::Out → 再失败只写日志,**绝不因输出中断安装**。',
        "`$script:SayLog = if (`$PSScriptRoot) { Join-Path `$PSScriptRoot '$logName' } else { Join-Path (Get-Location).Path '$logName' }",
        'function Say {',
        "    param([string]`$Text = '', [string]`$Color = '')",
        '    try {',
        '        if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }',
        '    } catch {',
        '        try { [Console]::Out.WriteLine($Text) } catch { }',
        '    }',
        '    try { Add-Content -LiteralPath $script:SayLog -Value $Text -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }',
        '}',
        '# Win7 默认没有 TLS1.2(.NET 4.5+ 才认识);HTTPS 服务器必须显式打开,失败不致命(HTTP 现场仍可用)',
        'try {',
        '    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12',
        '} catch { }',
        'if ($PSVersionTable.PSVersion.Major -lt 3) {',
        "    Say '[FAIL] 这台电脑的 PowerShell 版本太低(需要 3.0 及以上)。' 'Red'",
        "    Say '       Win7 请先装 WMF 5.1:https://www.microsoft.com/download/details.aspx?id=54616'",
        '    exit 1',
        '}',
        ''
    ) -join $nl
}

function Convert-WriteHost([string]$text) {
    $text = [regex]::Replace($text, 'Write-Host(\s+)([^\r\n]*?)\s+-ForegroundColor\s+(\w+)', 'Say$1$2 ''$3''')
    $text = [regex]::Replace($text, 'Write-Host(\s+)', 'Say$1')
    return $text
}

function Patch-File([string]$path, [string]$logName, [scriptblock]$extra) {
    $raw = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    # 先替换(此时文件里还没有 Say 定义),再插入兼容块
    $raw = Convert-WriteHost $raw
    if ($extra) { $raw = & $extra $raw }
    $anchor = '$ErrorActionPreference = ''Stop'''
    if (-not $raw.Contains($anchor)) { throw "找不到锚点: $path" }
    $raw = $raw.Replace($anchor, $anchor + (Get-CompatBlock $logName), 1)
    [IO.File]::WriteAllText($path, $raw, $utf8Bom)
    Write-Host "[patched] $path"
}

# ── ① 安装.ps1 ────────────────────────────────────────────────────
Patch-File (Join-Path $Root '安装.ps1') 'install.log' {
    param($t)
    $oldPrinter = @'
$realPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $n = $_.Name
    $n -ne 'Microsoft Print to PDF' -and $n -ne 'Microsoft XPS Document Writer' -and
    $n -ne 'OneNote' -and $n -ne 'OneNote (Desktop)' -and $n -ne 'Fax'
})
'@
    $newPrinter = @'
# Win7 没有 Get-Printer(Win8+/2012+ 才有 PrintManagement 模块)⇒ 用 .NET 的 InstalledPrinters,
# PS2/.NET2 就有,Win7/Win10 通用。
$virtualPrinters = @('Microsoft Print to PDF','Microsoft XPS Document Writer','OneNote','OneNote (Desktop)','Send To OneNote','Fax')
$realPrinters = @()
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $realPrinters = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters |
        Where-Object { $_ -and ($virtualPrinters -notcontains $_) })
} catch { $realPrinters = @() }
'@
    if (-not $t.Contains($oldPrinter)) { throw '安装.ps1: 找不到 Get-Printer 块' }
    $t = $t.Replace($oldPrinter, $newPrinter)
    $t = $t.Replace('$names = ($realPrinters | ForEach-Object { $_.Name }) -join '' / ''', '$names = ($realPrinters -join '' / '')')
    $t = $t.Replace('$Printer = $realPrinters[0].Name', '$Printer = $realPrinters[0]')
    return $t
}

# ── ② 卸载.ps1 ────────────────────────────────────────────────────
Patch-File (Join-Path $Root '卸载.ps1') 'uninstall.log' $null

# ── ③ print-agent.ps1 ────────────────────────────────────────────
Patch-File (Join-Path $Root 'print-agent.ps1') 'agent.log' {
    param($t)
    $old1 = @'
function Get-SystemPrinterName {
    try {
        $p = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
             Where-Object { $_.Default -eq $true } | Select-Object -First 1
        if ($p) { return $p.Name }
    } catch { }
    return ''
}
'@
    $new1 = @'
function Get-InstalledPrinterNames {
    # Win7 用 .NET(PS2/.NET2 就有);不依赖 Get-Printer(Win8+)/CIM 服务
    $names = @()
    try {
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        $names = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters)
    } catch { }
    return $names
}
function Get-SystemPrinterName {
    # 系统默认打印机:Win32_Printer 走 WMI(Win7 一定有),失败再看 .NET 第一台
    try {
        $p = Get-WmiObject -Class Win32_Printer -ErrorAction Stop |
             Where-Object { $_.Default -eq $true } | Select-Object -First 1
        if ($p) { return $p.Name }
    } catch { }
    $all = Get-InstalledPrinterNames
    if ($all.Count -gt 0) { return $all[0] }
    return ''
}
'@
    if (-not $t.Contains($old1)) { throw 'agent: 找不到 Get-SystemPrinterName 块' }
    $t = $t.Replace($old1, $new1)
    $old2 = @'
    try {
        $all = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
               Where-Object { $_.WorkOffline -ne $true }
        foreach ($p in $all) {
            if (-not (Test-VirtualPrinter $p.Name)) { return $p.Name }
        }
    } catch { }
'@
    $new2 = @'
    foreach ($n in (Get-InstalledPrinterNames)) {
        if (-not (Test-VirtualPrinter $n)) { return $n }
    }
'@
    if (-not $t.Contains($old2)) { throw 'agent: 找不到 Get-RealPrinterName 的 CIM 块' }
    $t = $t.Replace($old2, $new2)
    return $t
}

# ── ④ .bat:GBK + chcp 936(不再 65001)────────────────────────────
foreach ($bat in @('安装.bat','卸载.bat')) {
    $p = Join-Path $Root $bat
    $txt = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
    $txt = $txt -replace 'chcp 65001 >nul', 'chcp 936 >nul'
    [IO.File]::WriteAllText($p, $txt, $gbk)
    Write-Host "[patched] $p (GBK)"
}

