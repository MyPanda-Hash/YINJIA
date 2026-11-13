#!/usr/bin/env node
/**
 * 让 print-agent 的安装/卸载/代理脚本兼容 Windows 7 + PowerShell 5.1(2026-11-10 现场报 0x1F)。
 *
 * 现场症状:Win7 安装窗口里
 *   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
 *   occurred when writing console output buffer at current cursor position.
 * 病根 = install.bat 里的 `chcp 65001` + Win7 控制台输出缓冲区,Write-Host 一抛,
 *        $ErrorActionPreference='Stop' 就把安装打断(所以连环境检查都没跑完)。
 *
 * 本脚本做四件事:
 *   ① 所有 Write-Host → Say(带颜色也走它):控制台写不进去时退回 [Console]::Out,再不行只写日志,绝不中断;
 *   ② Get-Printer(Win8+ 才有)→ .NET InstalledPrinters;Get-CimInstance → Get-WmiObject/.NET;
 *   ③ 开 TLS1.2(Win7 默认没有)、检查 PowerShell ≥3、安装日志落 install.log;
 *   ④ .ps1 存 UTF-8 **带 BOM**(否则 PS5.1 读中文乱码);.bat 的 chcp 由 65001 改 936(GBK 另存)。
 *
 * 用法:node tools/archive/_print-agent-win7-20261110/patch-win7.mjs [目录]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || 'D:\\YINJIA-main\\deploy\\print-agent'

const COMPAT = (log) => `

# ── Win7 / 老 PowerShell 兼容(2026-11-10,现场 Win7 报 0x1F 后加)────────────────
# 现场症状(Win7 + PS 5.1,安装窗口里):
#   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
#                occurred when writing console output buffer at current cursor position.
# 触发条件 = chcp 65001 + 某些 Win7 控制台/远程会话下控制台输出缓冲区不可写;Write-Host 一抛,
# $ErrorActionPreference='Stop' 就把安装打断。下面统一走 Say:
#   先试带颜色 Write-Host → 失败退 [Console]::Out → 再失败只写日志,**绝不因输出中断安装**。
$script:SayLog = if ($PSScriptRoot) { Join-Path $PSScriptRoot '${log}' } else { Join-Path (Get-Location).Path '${log}' }
function Say {
    param([string]$Text = '', [string]$Color = '')
    try {
        if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
    } catch {
        try { [Console]::Out.WriteLine($Text) } catch { }
    }
    try { Add-Content -LiteralPath $script:SayLog -Value $Text -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }
}
# Win7 默认没有 TLS1.2(.NET 4.5+ 才认识);HTTPS 服务器必须显式打开,失败不致命(HTTP 现场仍可用)
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }
if ($PSVersionTable.PSVersion.Major -lt 3) {
    Say '[FAIL] 这台电脑的 PowerShell 版本太低(需要 3.0 及以上)。' 'Red'
    Say '       Win7 请先装 WMF 5.1:https://www.microsoft.com/download/details.aspx?id=54616'
    exit 1
}
`

const toSay = (src) => src
  // Write-Host "x" -ForegroundColor Green  →  Say "x" 'Green'
  .replace(/Write-Host(\s+)([^\r\n]*?)\s+-ForegroundColor\s+(\w+)/g, "Say$1$2 '$3'")
  // 其余 Write-Host → Say
  .replace(/Write-Host(\s+)/g, 'Say$1')

function patch(file, log, edits) {
  const p = join(root, file)
  let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  // 幂等:已经打过的文件直接跳过(避免重复插兼容块/重复替换)
  if (t.includes('function Say {')) {
    console.log(`[skip] ${file} 已打过补丁`)
    return
  }
  const anchor = "$ErrorActionPreference = 'Stop'"
  if (!t.includes(anchor)) throw new Error(`${file}: 找不到锚点 $ErrorActionPreference`)
  t = toSay(t)
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error(`${file}: 找不到要替换的片段:\n${from.slice(0, 80)}`)
    t = t.split(from).join(to)
  }
  t = t.replace(anchor, anchor + COMPAT(log))
  writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
  console.log(`[patched] ${file}`)
}

patch('安装.ps1', 'install.log', [
  [`$realPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $n = $_.Name
    $n -ne 'Microsoft Print to PDF' -and $n -ne 'Microsoft XPS Document Writer' -and
    $n -ne 'OneNote' -and $n -ne 'OneNote (Desktop)' -and $n -ne 'Fax'
})`,
`# Win7 没有 Get-Printer(Win8+/2012+ 才有 PrintManagement 模块)⇒ 用 .NET 的 InstalledPrinters,
# PS2/.NET2 就有,Win7/Win10 通用。
$virtualPrinters = @('Microsoft Print to PDF','Microsoft XPS Document Writer','OneNote','OneNote (Desktop)','Send To OneNote','Fax')
$realPrinters = @()
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $realPrinters = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters |
        Where-Object { $_ -and ($virtualPrinters -notcontains $_) })
} catch { $realPrinters = @() }`],
  [`$names = ($realPrinters | ForEach-Object { $_.Name }) -join ' / '`, `$names = ($realPrinters -join ' / ')`],
  [`$Printer = $realPrinters[0].Name`, `$Printer = $realPrinters[0]`],
  [`    [int]$Port = 18777
)`, `    [int]$Port = 18777,
    # 只体检不落地(2026-11-10):检查环境/账号/打印机后退出,不写配置、不设自启、不起代理。
    [switch]$DryRun
)`],
  [`# ── ③ 写配置 + 开机自启(参数一起写进去) ─────────────────────────`,
`# ── DryRun:只体检不落地(现场排障用)───────────────────────────────
if ($DryRun) {
    Say ''
    Say '[DryRun] 环境与账号检查通过;本次不写配置、不设开机自启、不启动代理。' 'Cyan'
    Say "  服务器  : $Server"
    Say "  打印点  : $Station"
    Say "  出纸方式: $Mode"
    Say "  打印机  : $Printer"
    Say "  端口    : $Port"
    Say "  日志    : $script:SayLog"
    exit 0
}

# ── ③ 写配置 + 开机自启(参数一起写进去) ─────────────────────────`],
])

patch('卸载.ps1', 'uninstall.log', [
  [`    $procs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |`,
   `    # Win7:用 WMI(Get-WmiObject)而不是 CIM,CIM 在 Win7 需要额外服务/可能不可用
    $procs = Get-WmiObject Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |`],
])

patch('print-agent.ps1', 'agent.log', [
  [`function Get-SystemPrinterName {
    try {
        $p = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
             Where-Object { $_.Default -eq $true } | Select-Object -First 1
        if ($p) { return $p.Name }
    } catch { }
    return ''
}`,
`function Get-InstalledPrinterNames {
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
}`],
  [`    try {
        $all = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
               Where-Object { $_.WorkOffline -ne $true }
        foreach ($p in $all) {
            if (-not (Test-VirtualPrinter $p.Name)) { return $p.Name }
        }
    } catch { }`,
`    foreach ($n in (Get-InstalledPrinterNames)) {
        if (-not (Test-VirtualPrinter $n)) { return $n }
    }`],
])

// .bat:原始文件是 GBK 编码 —— 必须**按字节**替换 chcp,不能用 utf8 读(否则中文全变 ?)
for (const bat of ['安装.bat', '卸载.bat']) {
  const p = join(root, bat)
  const s = readFileSync(p).toString('latin1')          // latin1 = 1:1 字节,不碰中文
  if (!s.includes('chcp 65001 >nul') && !s.includes('chcp 936 >nul')) {
    console.log(`[skip] ${bat} 没有 chcp 65001`)
    continue
  }
  const out = s.replace('chcp 65001 >nul', 'chcp 936 >nul')
  writeFileSync(p, Buffer.from(out, 'latin1'))
  console.log(`[patched] ${bat} (字节级 chcp 936,保留 GBK 中文)`)
}
