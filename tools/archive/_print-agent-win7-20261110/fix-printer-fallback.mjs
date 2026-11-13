// 2026-11-10 现场:打印失败「已删除指定的打印机。」——
//   配置里是 "EPSON LQ-635KII ESC/P2 (副本 1)"(打印机副本),系统里已不存在/被删;
//   PDF 兜底又写死 "Microsoft Print to PDF" —— Win7 根本没这台(Win10 才有),所以两条路都断。
// 改法:
//   ① 打印前把配置的打印机名与系统清单核对(忽略 "(副本 N)"、空格、大小写),对不上就换可用真机并记日志;
//   ② PDF 兜底改成在系统里找任一 PDF 虚拟打印机(WPS/福昕/Adobe/Microsoft);
//   ③ $doc.Print() 失败时换下一台候选打印机重试(最多 3 台),全失败才抛。
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'D:/YINJIA-main/deploy/print-agent/'
const p = dir + 'print-agent.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

if (t.includes('function Resolve-PrinterName')) {
  console.log('[skip] 已有打印机解析/回退')
  process.exit(0)
}

// ① 在 Get-RealPrinterName 之后插入两个工具函数
const anchor = `function Get-RealPrinterName {
    param([string]$Prefer)
    if ($Prefer -and -not (Test-VirtualPrinter $Prefer)) { return $Prefer }
    $def = Get-SystemPrinterName
    if ($def -and -not (Test-VirtualPrinter $def)) { return $def }
    foreach ($n in (Get-InstalledPrinterNames)) {
        if (-not (Test-VirtualPrinter $n)) { return $n }
    }
    return ''
}`
if (!t.includes(anchor)) throw new Error('找不到 Get-RealPrinterName')

const helpers = anchor + `

# ── 打印机名核对(2026-11-10)────────────────────────────────────────────
# 现场配置里是 "EPSON LQ-635KII ESC/P2 (副本 1)",系统里这台"副本"已被删 ⇒ 打印报
# 「已删除指定的打印机。」。这里按「去掉 (副本 N)、空格、大小写」比对系统清单,
# 对不上就返回空,让调用方换一台可用真机(并记日志),而不是死在一个陈旧名字上。
function Get-PrinterNameKey {
    param([string]$Name)
    if (-not $Name) { return '' }
    $k = $Name -replace '\\s*\\(\\s*副本\\s*\\d+\\s*\\)\\s*', ' '
    $k = $k -replace '\\s+', ' '
    return $k.Trim().ToUpper()
}

function Resolve-PrinterName {
    param([string]$Name)
    $all = @(Get-InstalledPrinterNames)
    if ($all.Count -eq 0) { return '' }
    if ($Name -and ($all -contains $Name)) { return $Name }
    if (-not $Name) { return '' }
    $k = Get-PrinterNameKey $Name
    if (-not $k) { return '' }
    foreach ($p in $all) { if ((Get-PrinterNameKey $p) -eq $k) { return $p } }
    foreach ($p in $all) {
        $pk = Get-PrinterNameKey $p
        if ($pk -and ($pk.Contains($k) -or $k.Contains($pk))) { return $p }
    }
    return ''
}

# PDF 兜底用的虚拟打印机:Win7 没有 Microsoft Print to PDF,常见是 WPS/福昕/Adobe
function Get-PdfPrinterName {
    $all = @(Get-InstalledPrinterNames)
    $prefer = @(
        'Microsoft Print to PDF',
        '导出为WPS PDF', 'WPS PDF', 'WPS Office PDF',
        'Foxit Reader PDF Printer', 'Foxit PDF Printer', 'Foxit PhantomPDF Printer',
        'Adobe PDF', 'CutePDF Writer', 'Bullzip PDF Printer'
    )
    foreach ($k in $prefer) {
        foreach ($p in $all) { if ($p -eq $k) { return $p } }
    }
    foreach ($p in $all) { if ($p -match 'PDF') { return $p } }
    return ''
}`

t = t.replace(anchor, helpers)

// ② PDF 分支:找系统里任意 PDF 虚拟打印机
const oldPdf = `    if ($PdfPath) {
        $pdfPrinter = 'Microsoft Print to PDF'
        $doc.PrinterSettings.PrinterName = $pdfPrinter
        if (-not $doc.PrinterSettings.IsValid) {
            throw "找不到虚拟打印机「$pdfPrinter」:请在 Windows「打印机和传真」里启用它(系统自带,可能被关掉了)"
        }`
if (!t.includes(oldPdf)) throw new Error('找不到 PDF 分支')
const newPdf = `    if ($PdfPath) {
        $pdfPrinter = Get-PdfPrinterName
        if (-not $pdfPrinter) {
            $allPd = @(Get-InstalledPrinterNames)
            throw ("这台电脑没有可用的 PDF 虚拟打印机(Win7 没有系统自带的 Microsoft Print to PDF)。" +
                   "请装 WPS/福昕阅读器后重试,或在「打印机」里启用一个 PDF 打印机。当前已装:" + ($allPd -join ' / '))
        }
        if ($pdfPrinter -ne 'Microsoft Print to PDF') { Say "[PDF ] 用「$pdfPrinter」落 PDF" 'DarkGray' }
        $doc.PrinterSettings.PrinterName = $pdfPrinter
        if (-not $doc.PrinterSettings.IsValid) {
            throw "找不到虚拟打印机「$pdfPrinter」:请在 Windows「打印机和传真」里启用它"
        }`
t = t.replace(oldPdf, newPdf)

// ③ 真打印机分支:核对名字 + 候选列表
const oldReal = `    } else {
        if ($PrinterName) { $doc.PrinterSettings.PrinterName = $PrinterName }
        if (-not $doc.PrinterSettings.IsValid) {
            throw "打印机不可用:[$PrinterName](检查打印机名称,或在网页里留空使用系统默认打印机)"
        }
    }`
if (!t.includes(oldReal)) throw new Error('找不到真打印机分支')
const newReal = `    } else {
        # 配置的名字可能已失效(如 "…(副本 1)" 被删)⇒ 先核对,再准备候选列表逐台重试
        $script:PrintCandidates = @()
        if ($PrinterName) { $script:PrintCandidates += $PrinterName }
        $resolved = Resolve-PrinterName $PrinterName
        if ($resolved) { $script:PrintCandidates += $resolved }
        $realFallback = Get-RealPrinterName -Prefer ''
        if ($realFallback) { $script:PrintCandidates += $realFallback }
        $script:PrintCandidates = @($script:PrintCandidates | Where-Object { $_ } | Select-Object -Unique)
        $picked = ''
        foreach ($c in $script:PrintCandidates) {
            $doc.PrinterSettings.PrinterName = $c
            if ($doc.PrinterSettings.IsValid) { $picked = $c; break }
        }
        if (-not $picked) {
            $allPd = @(Get-InstalledPrinterNames)
            throw ("打印机不可用:[$PrinterName]。这台电脑上可用的打印机:" + ($allPd -join ' / ') +
                   " (在「自动打印」页把打印机留空即用系统默认)")
        }
        if ($picked -ne $PrinterName) { Say ("[打印机] 配置的「{0}」不在系统里,改用「{1}」" -f $PrinterName, $picked) 'Yellow' }
    }`
t = t.replace(oldReal, newReal)

// ④ Print() 失败换下一台候选重试
const oldPrint = `    $doc.Print()
    if ($qrImg) { $qrImg.Dispose() }`
if (!t.includes(oldPrint)) throw new Error('找不到 doc.Print()')
const newPrint = `    # 打印可能因驱动/打印机被删而失败 ⇒ 换候选列表里的下一台重试(最多 3 台)
    $printed = $false
    $lastErr = $null
    $tryIdx = 0
    while (-not $printed) {
        try {
            $doc.Print()
            $printed = $true
        } catch {
            $lastErr = $_.Exception.Message
            $cands = @($script:PrintCandidates)
            if ($tryIdx + 1 -ge $cands.Count -or $tryIdx -ge 2) { throw }
            $tryIdx++
            $next = $cands[$tryIdx]
            Say ("[打印机] 打印失败({0}),改试「{1}」" -f $lastErr, $next) 'Yellow'
            $doc.PrinterSettings.PrinterName = $next
            if (-not $doc.PrinterSettings.IsValid) { throw }
        }
    }
    if ($qrImg) { $qrImg.Dispose() }`
t = t.replace(oldPrint, newPrint)

writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
console.log('[patched] 打印机解析 + PDF 兜底 + 失败换机重试')
