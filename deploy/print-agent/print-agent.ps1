<#
.SYNOPSIS
  YINJIA-MES 本地打印代理(2026-10-30)

.DESCRIPTION
  在「打印电脑」上常驻运行的小程序:本系统网页(「自动打印」页)会把待打印任务发给它,
  它用**系统打印机静默出纸** —— 全程不需要人点任何按钮。

  为什么需要它(不能纯靠浏览器):
    浏览器标准的 window.print() **一定**会弹出打印对话框,没有任何浏览器参数能关掉它。
    要做到「手机点了,那台电脑直接出纸」,只能由本机程序调系统打印。

  它做什么:
    · 监听 http://127.0.0.1:18777(只绑本机回环,局域网内其它机器访问不到);
    · GET  /health  → {ok:true, version, printer}   网页据此判断「代理已连接」;
    · POST /print   → 收 {二维码内容, 标题, 工单号, 工单行号, 产品名称, 规格型号, printer}
                      → 打印一张工单标签 → 返回 {ok:true, mode, printer};
    · POST /test    → 打印一张测试标签(配置时验证打印机通不通)。

  标签形态(**纯文本标签**,2026-10-30 定稿):
    工单号 / 工单行号 / 产品 / 规格 / 扫码内容。
    为什么不出二维码图:出图要么依赖第三方库,要么靠 Edge 无头截图;
    无头截图在本机实测会**卡死**(msedge --headless=new --screenshot 有不小概率不退出也不写文件,
    把 HTTP 响应挂死) —— 现场"点了打印没反应"最难查。
    ⇒ 代理只打文本标签;**真正的二维码由手机端打印通道生成**(网页用 qrcode 库,见 print-formats.js),
      分工清楚、两边都不依赖对方。

.PARAMETER Install
  设为开机自启(写入 HKCU\...\Run)。撤销用 -Uninstall。

.PARAMETER Port
  监听端口,默认 18777。改端口要同步改前端 src/business/printStation.js 的 AGENT_URL。

.PARAMETER Printer
  目标打印机名;空 = 系统默认打印机。网页里配的打印机名会随任务一起发来,优先用它。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\printing\print-agent.ps1
  powershell -ExecutionPolicy Bypass -File tools\printing\print-agent.ps1 -Install
  powershell -ExecutionPolicy Bypass -File tools\printing\print-agent.ps1 -Uninstall
  powershell -ExecutionPolicy Bypass -File tools\printing\print-agent.ps1 -Printer "Kyocera ECOSYS M8124cidn"
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Uninstall,
    [int]$Port = 18777,
    [string]$Printer = '',
    # 出纸方式(2026-11-01 加):
    #   Printer = 调系统打印机真出纸(默认,现场有打印机时用这个);
    #   Pdf     = **不碰打印机**,把同样版式的标签输出成一个 PDF 文件(暂时没打印机时用)。
    # 两个模式打印**同一套版式**(同一个 Send-LabelToPrinter),所以有打印机后
    # 只要把 -Mode 换回 Printer 重启代理,版式不用重调。
    [ValidateSet('Auto', 'Printer', 'Pdf')]
    [string]$Mode = 'Auto',
    # PDF 输出目录(仅 -Mode Pdf 用);空 = 脚本同级 print-out\
    [string]$PdfDir = '',
    # 🔴 2026-11-03 「代理自己去服务器取任务」(解决公网页面连不上本机代理)
    #   背景:页面开在公网 HTTP 地址上时,浏览器**禁止**它访问 127.0.0.1(非安全上下文),
    #   连 CORS 预检都不发 ⇒ 页面永远「代理未连接」。与其跟浏览器较劲,不如让代理主动拉:
    #   代理自己登录服务器、轮询 /pending、打印、回 /ack —— 全程不需要浏览器。
    [string]$Server = '',
    [string]$User = 'admin',
    [string]$Pass = '',
    [string]$Factory = 'YJ',
    [string]$Station = '打印电脑'
)

$ErrorActionPreference = 'Stop'

# ── Win7 / 老 PowerShell 兼容(2026-11-10,现场 Win7 报 0x1F 后加)────────────────
# 现场症状(Win7 + PS 5.1,安装窗口里):
#   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
#                occurred when writing console output buffer at current cursor position.
# 触发条件 = chcp 65001 + 某些 Win7 控制台/远程会话下控制台输出缓冲区不可写;Write-Host 一抛,
# $ErrorActionPreference='Stop' 就把安装打断。下面统一走 Say:
#   先试带颜色 Write-Host → 失败退 [Console]::Out → 再失败只写日志,**绝不因输出中断安装**。
$script:SayLog = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'agent.log' } else { Join-Path (Get-Location).Path 'agent.log' }
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
# PS2(Win7 自带):没有 ConvertFrom-Json / ConvertTo-Json / Invoke-WebRequest(都是 3.0+ 才有)。
# 用户口径「要兼容,能够一键完成,不要多余操作」⇒ 加载同目录兼容层,不让客户去装 WMF。
$script:HereDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if ($PSVersionTable.PSVersion.Major -lt 3) {
    $compatFile = Join-Path $script:HereDir 'compat-ps2.ps1'
    if (-not (Test-Path $compatFile)) { Say "[FAIL] 同目录缺少 compat-ps2.ps1,请把整个文件夹一起拷贝: $compatFile" 'Red'; exit 1 }
    . $compatFile
}

$AgentVersion = '1.1.0'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'
$ScriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }

# PDF 输出目录:默认放在脚本同级的 print-out\(不污染仓库根)
if (-not $PdfDir) { $PdfDir = Join-Path (Split-Path -Parent $ScriptPath) 'print-out' }

# ── 自启注册 / 注销 ────────────────────────────────────────────────
if ($Uninstall) {
    if (Test-Path $RunKey) {
        Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
        Say "[OK] 已取消开机自启: $RunName"
    }
    Say '代理进程如仍在运行,请在任务管理器里结束对应 powershell 进程(或重启电脑)。'
    return
}

if ($Install) {
    $cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ScriptPath"" -Port $Port -Mode $Mode"
    # ⚠ 只在**不存在**时创建:对已存在的注册表键用 `New-Item -Force` 会抛
    #   「The data area passed to a system call is too small」(2026-11-01 实测踩到,
    #   直接导致 -Install 整个失败、代理也没起来)。Run 键几乎必然存在,所以这里基本不建。
    if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
    Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
    Say "[OK] 已设为开机自启: $RunName"
    Say "     $cmd"
    Say '     下次开机会自动在后台运行;现在先手动跑一次即可生效。'
    Say ''
}

# ── 打印机 ────────────────────────────────────────────────────────

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

<#
 * 虚拟打印机名单:这些"打印机"其实不落纸(存文件/发传真),
 * Auto 模式**绝不能**把它们当成"有打印机"—— 否则用户以为在出纸,实际弹了个保存对话框,
 * 或者干脆静默存成文件、产线上什么都没有。
#>
$VirtualPrinterNames = @(
    'Microsoft Print to PDF',
    'Microsoft XPS Document Writer',
    'OneNote',
    'OneNote (Desktop)',
    'Fax',
    'Send To OneNote'
)

function Test-VirtualPrinter {
    param([string]$Name)
    if (-not $Name) { return $true }
    foreach ($v in $VirtualPrinterNames) {
        if ($Name -eq $v -or $Name -like "$v*") { return $true }
    }
    return $false
}

<#
 * 找一台**能真出纸**的打印机(2026-11-01 Auto 模式用)。
 *
 * 优先系统默认(但必须是真机),否则按名字取第一台在线的真机。
 * 返回值空 = 这台电脑没有可用打印机 ⇒ Auto 直接走 PDF 兜底。
#>
function Get-RealPrinterName {
    param([string]$Prefer)
    if ($Prefer -and -not (Test-VirtualPrinter $Prefer)) { return $Prefer }
    $def = Get-SystemPrinterName
    if ($def -and -not (Test-VirtualPrinter $def)) { return $def }
    foreach ($n in (Get-InstalledPrinterNames)) {
        if (-not (Test-VirtualPrinter $n)) { return $n }
    }
    return ''
}

<#
  把一张工单标签送到打印机(**不弹任何对话框**)。

  用 System.Drawing.Printing —— .NET 自带能力,不需要装任何东西。
  真实打印机 / XPS / PDF 虚拟打印机都一样对待:PrintController 设成 StandardPrintController,
  这样连"正在打印…"进度框都不会冒出来,才是真正的静默。
#>
<#
  Get-CellLines — 按宽度把文本贪心折成最多 N 行(2026-11-06)

  为什么自己折:GDI+ 的自动换行只在**空格**处断,而"规格"里全是中英混排、
  没有空格的串(如 38.5*38.5*26（超长规格文字测试）),它压根不断 ⇒ 整段被矩形裁掉,
  纸面上就是"字被挡住"。这里按字符测宽、逐字累加,保证每行都放得下。
#>
function Get-CellLines {
    param($Graphics, [string]$Text, $Font, [double]$MaxWidth, [int]$MaxLines = 2)
    if (-not $Text) { return @('') }
    $lines = New-Object System.Collections.ArrayList
    $cur = ''
    $i = 0
    $chars = $Text.ToCharArray()
    while ($i -lt $chars.Length) {
        $probe = $cur + $chars[$i]
        $tooWide = ($cur.Length -gt 0) -and ($Graphics.MeasureString($probe, $Font).Width -gt $MaxWidth)
        if ($tooWide) {
            [void]$lines.Add($cur)
            $cur = ''
            if ($lines.Count -ge ($MaxLines - 1)) {
                # 已经是最后一行:剩下的全塞进去(真放不下时由绘制矩形裁掉,不会挤到隔壁格子)
                $cur = -join $chars[$i..($chars.Length - 1)]
                break
            }
            continue
        }
        $cur = $probe
        $i++
    }
    if ($cur.Length -gt 0) { [void]$lines.Add($cur) }
    # 折成 2 行时尽量"对半分":贪心会把第一行塞满、第二行只剩个"）"这种尾巴,纸面很难看。
    # 这里再按字符数对半试一次,两半都放得下就用它(中文基本对得齐,纯 ASCII 也只会更均衡)。
    if ($lines.Count -eq 2 -and $Text.Length -ge 4) {
        $half = [int][Math]::Ceiling($Text.Length / 2)
        # ① 优先在**空格**处断(别把 "12.7*2.82" 这种数字拆成两半):挑离中间最近、且两半都放得下的空格
        $best = -1
        for ($k = 0; $k -lt $Text.Length; $k++) {
            if ($Text[$k] -ne ' ') { continue }
            $a = $Text.Substring(0, $k)
            $bTxt = $Text.Substring($k + 1)
            if (-not $bTxt) { continue }
            if ($Graphics.MeasureString($a, $Font).Width -le $MaxWidth -and
                $Graphics.MeasureString($bTxt, $Font).Width -le $MaxWidth) {
                if ($best -lt 0 -or [Math]::Abs($k - $half) -lt [Math]::Abs($best - $half)) { $best = $k }
            }
        }
        if ($best -ge 0) {
            return @($Text.Substring(0, $best), $Text.Substring($best + 1))
        }
        # ② 没有空格(纯中文/规格串):按字数对半
        $a = $Text.Substring(0, $half)
        $bTxt = $Text.Substring($half)
        if ($Graphics.MeasureString($a, $Font).Width -le $MaxWidth -and $Graphics.MeasureString($bTxt, $Font).Width -le $MaxWidth) {
            return @($a, $bTxt)
        }
    }
    return $lines
}
function Send-LabelToPrinter {
    param(
        [string]$Title,
        [string]$WoNo,
        [int]$WoLine,
        [string]$ProductName,
        [string]$Spec,
        [string]$QrText,
        [string]$PrinterName,
        # 非空 = 不走打印机,改用 "Microsoft Print to PDF" 静默落成这个 PDF 文件(2026-11-01)
        [string]$PdfPath = '',
        # 二维码图的 dataURL(2026-11-01):前端用 qrcode 库生成好传上来,这里直接贴进标签。
        # 空 = 不贴码(退回纯文字版,不让整张标签因为缺图而失败)。
        [string]$QrImage = '',
        # 纸面「领料单」用的抬头与明细(2026-11-02):明细行 = 材料名称/规格/单位/请领数量/实发数量/备注
        [string]$OutNo = '',
        [string]$Dept = '',
        [string]$PrintDate = '',
        [array]$Rows = @(),
        # 纸张(2026-11-05,按每台电脑在「自动打印」页配置):A5=中一刀 210×148.5 横(默认) / A4=297×210 横。
        # ⚠ 只换纸不缩放:绘制坐标永远是 210×148mm,内容大小与版面一个像素都不变。
        [string]$Paper = 'A5'
    )
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop

    # 把 dataURL 解成 Image 对象(只解一次,PrintPage 回调里复用)
    $qrImg = $null
    if ($QrImage) {
        try {
            $b64 = $QrImage
            $comma = $b64.IndexOf(',')
            if ($comma -ge 0) { $b64 = $b64.Substring($comma + 1) }
            $bytes = [Convert]::FromBase64String($b64)
            $ms = New-Object System.IO.MemoryStream(,$bytes)
            $qrImg = [System.Drawing.Image]::FromStream($ms)
        } catch {
            Say "[WARN] 二维码图解码失败,本轮只打文字: $($_.Exception.Message)" 'Yellow'
            $qrImg = $null
        }
    }

    # ⚠ 先算成变量:PowerShell 的 "…$(if (…) {"…"} else {…})…" 嵌套双引号极易被咬掉,
    #   实测报「字符串缺少终止符」。一律先赋值再插值。
    $lineText = ''
    if ($WoLine -gt 0) { $lineText = '#' + $WoLine }

    $doc = New-Object System.Drawing.Printing.PrintDocument

        # ── PDF 模式(2026-11-01):不碰真打印机 ─────────────────────────────
    # 借 Windows 自带的「Microsoft Print to PDF」虚拟打印机 + PrintToFile 把同一版式
    # **静默**落成 PDF —— 不会弹"另存为"对话框(那是普通用户点打印才有的行为)。
    # 关键三件:PrinterName 指向虚拟打印机、PrintToFile=$true、PrintFileName 给死路径。
    if ($PdfPath) {
        $pdfPrinter = 'Microsoft Print to PDF'
        $doc.PrinterSettings.PrinterName = $pdfPrinter
        if (-not $doc.PrinterSettings.IsValid) {
            throw "找不到虚拟打印机「$pdfPrinter」:请在 Windows「打印机和传真」里启用它(系统自带,可能被关掉了)"
        }
        $doc.PrinterSettings.PrintToFile = $true
        $doc.PrinterSettings.PrintFileName = $PdfPath
    } else {
        if ($PrinterName) { $doc.PrinterSettings.PrinterName = $PrinterName }
        if (-not $doc.PrinterSettings.IsValid) {
            throw "打印机不可用:[$PrinterName](检查打印机名称,或在网页里留空使用系统默认打印机)"
        }
    }
    $doc.DocumentName = "YINJIA-MES $Title $WoNo"
    # StandardPrintController = 不显示进度对话框 ⇒ 真静默
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
# 🔴 2026-11-02 用户口径:「打印的大小是中一刀,A4纸的一半,横打」。
    #   中一刀 = 210mm × 148.5mm。本来想用自定义 PaperSize(827×585) 直接设,但实测
    #   **Microsoft Print to PDF 会把自定义纸型丢掉、仍输出 A4**(读回 PaperSize 是对的,
    #   PDF 的 /MediaBox 却是 595x842pt)⇒ 换成等价的标准纸:
    #   **A5(148×210) 横放 = 210×148mm**,正好是中一刀。标准纸型所有驱动都认。
    #
    # 🔴 2026-11-05 用户口径:「能不能设定打印的纸张大小(如 A4 或 A5),但是表格实际占用大小不变」。
    #   ⇒ 纸张由「自动打印」页**按每台电脑**配置,服务端随任务下发 `纸张`(A5 / A4):
    #     · A5(默认)= 中一刀 210×148.5mm 横打,与以前一字不差;
    #     · A4      = A4 横 297×210mm —— **只换纸、不缩放**:下面的绘制坐标仍是 210×148mm,
    #                 内容从纸张左上角起画(表格/字号一个都不变),多出来的部分是空白。
    #   注意:这里只能选**标准纸型**;自定义纸型会被 PDF 驱动丢掉(上面那条踩坑)。
    $script:W100 = 827   # 横向 210mm ≈ 8.27in(1/100 英寸)
    $script:H100 = 583   # 纵向 148mm ≈ 5.83in(A5 短边)
    $paperKind = if (([string]$Paper).Trim().ToUpper() -eq 'A4') { 'A4' } else { 'A5' }
    try {
        $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq $paperKind } | Select-Object -First 1
        if (-not $ps) { $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.PaperName -match $paperKind } | Select-Object -First 1 }
        if ($ps) {
            $doc.DefaultPageSettings.PaperSize = $ps
            $doc.DefaultPageSettings.Landscape = $true    # 横打:A5→210×148 / A4→297×210
            $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
            Say ("[版面] 纸张 = {0} 横打(内容仍 210×148mm,不缩放)" -f $paperKind) 'DarkGray'
        } else {
            Say ("[WARN] 打印机没有 {0} 纸型,按默认纸输出" -f $paperKind) 'Yellow'
        }
    } catch {
        Say ("[WARN] 设置纸张({0} 横版)失败,按默认纸输出: {1}" -f $paperKind, $_.Exception.Message) 'Yellow'
    }

    # 版式数据交给回调(script 作用域,PrintPage 里能读到)
    $script:pTitle = $Title
    $script:pWoNo  = $WoNo
    $script:pLine  = $lineText
    $script:pProd  = $ProductName
    $script:pSpec  = $Spec
    $script:pQrTxt = $QrText
    $script:labelQr = $qrImg
    $script:pOutNo = $OutNo
    $script:pDept  = $Dept
    $script:pDate  = $PrintDate
    $script:pRows  = @($Rows)

    # 🔴 2026-11-05 分页:用户问「打印行数会有限制吗?如果大于 9 行,还能打印吗」。
    #   改前是 `if ($rowCount -gt 12) { $rowCount = 12 }` —— 一页最多 12 行,**第 13 行起
    #   直接被丢掉**,现场看到的是一张"少料"的领料单,比打不出来更危险。
    #   现在:一页放 PER_PAGE 行,超出自动续页(每页都重复抬头/表格线/签名),没有上限。
    $script:pPage = 0
    $script:pPerPage = 10      # 一页 10 行时行高 ≈ 30px,仍然好读;再多就续页
    $script:pTotalPages = [Math]::Max(1, [int][Math]::Ceiling((@($script:pRows).Count) / $script:pPerPage))

    $doc.add_PrintPage({
        param($sender, $e)
        try {
        $g = $e.Graphics
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        $pageW = 827   # 210mm
        $pageH = 583   # 148mm
        $black = [System.Drawing.Brushes]::Black
        $gray  = [System.Drawing.Brushes]::DimGray

        $fontTitle = New-Object System.Drawing.Font('Microsoft YaHei', 24, [System.Drawing.FontStyle]::Bold)
        $fontNo    = New-Object System.Drawing.Font('Microsoft YaHei', 13, [System.Drawing.FontStyle]::Bold)
        $fontHead  = New-Object System.Drawing.Font('Microsoft YaHei', 9.5, [System.Drawing.FontStyle]::Bold)
        # 🔴 2026-11-06 用户口径「打印效果不好,字被挡住、没有显示完整」:
        #   格子字号 10 → 8.5,并把「材料名称 / 规格」两列改成**允许换行**(见 $fmtW)。
        $fontCell  = New-Object System.Drawing.Font('Microsoft YaHei', 8)
        # 自适应字号阶梯:8 → 7.5 → 7 → 6.5 → 6(放不下才折行,见明细绘制处)
        $cellFonts = @(8, 7.5, 7, 6.5, 6) | ForEach-Object { New-Object System.Drawing.Font('Microsoft YaHei', $_) }
        $fontFoot  = New-Object System.Drawing.Font('Microsoft YaHei', 10.5)
        $penLine   = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1.6)
        $fmtC = New-Object System.Drawing.StringFormat
        $fmtC.Alignment = [System.Drawing.StringAlignment]::Center
        $fmtL = New-Object System.Drawing.StringFormat
        $fmtL.Alignment = [System.Drawing.StringAlignment]::Near
        # 短列(订单号/单位/数量/备注)不换行:纸表格子高度有限,换行会被切掉半截
        $fmtL.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
        # 长文本列(材料名称、规格)**允许折行**:宁可两行显示全,也不要被截成 "滤芯内盖(闭孔"
        $fmtW = New-Object System.Drawing.StringFormat
        $fmtW.Alignment = [System.Drawing.StringAlignment]::Near
        $fmtW.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit

        # 本页要画哪些明细(2026-11-05 分页):按页号切片,页内至少 8 行格子(纸表是固定格式)
        $pageIdx = [int]$script:pPage
        $script:pPage = $pageIdx + 1
        $allRows = @($script:pRows)
        $startAt = $pageIdx * [int]$script:pPerPage
        $pageRows = @()
        if ($startAt -lt $allRows.Count) {
            $takeN = [Math]::Min([int]$script:pPerPage, $allRows.Count - $startAt)
            $pageRows = @($allRows[$startAt..($startAt + $takeN - 1)])
        }

        # ① 左上角二维码(用户样张的"红框"位置):码 + 细黑框
        # 🔴 2026-11-05 用户口径「二维码过大」:132 → 96。原文按 132 画,占了整张中一刀的
        #   近 1/6 面积,标题被挤到右边、表格也被压窄;96(≈24mm)扫码完全够用。
        $qrSize = 96
        if ($script:labelQr) {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($script:labelQr, 26, 20, $qrSize, $qrSize)
        }
        # 二维码外框:纸表风格细黑框(样张上的红框是用户标注,纸面本身是黑线表格)
        $g.DrawRectangle($penLine, 22, 16, $qrSize + 8, $qrSize + 8)

        # ② 标题居中 + 右上 No 单号
        $titleRect = New-Object System.Drawing.RectangleF(0, 26, $pageW, 60)
        $g.DrawString($script:pTitle, $fontTitle, $black, $titleRect, $fmtC)
        $noText = 'No ' + $script:pOutNo
        $g.DrawString($noText, $fontNo, $black, 590, 40)

        # ③ 领料部门 / 日期(随二维码缩小上移,让表格多吃两行)
        $g.DrawString('领料部门:', $fontFoot, $gray, 26, 134)
        $g.DrawString($script:pDept, $fontCell, $black, 112, 134)
        $g.DrawString('日期:', $fontFoot, $gray, 590, 134)
        $g.DrawString($script:pDate, $fontCell, $black, 638, 134)
        # 多页时右上角标"第 n/N 页"(单页不画,免得多余)
        if ([int]$script:pTotalPages -gt 1) {
            $pgText = '第 ' + ($pageIdx + 1) + '/' + $script:pTotalPages + ' 页'
            $g.DrawString($pgText, $fontFoot, $gray, 590, 96)
        }

        # ④ 明细表格:七列,行数 = max(8, 本页实际行数)
        $x0 = 22
        $y0 = 166
        # 列宽(总 780)。2026-11-06 重排:订单号从 168 收到 130(足够放 "GD-2026-11-0018#1"),
        #   省下来的宽度给「规格」(118→165)和「材料名称」(172→150),单位 45→45,
        #   避免 "滤芯内盖（闭孔）" 这类被截成 "滤芯内盖（闭孔"。
        $colW = @(130, 138, 150, 70, 85, 85, 122)
        $totalW = 0
        foreach ($cw in $colW) { $totalW += $cw }
        $headH = 40
        $rows = @($pageRows)
        $rowCount = [Math]::Max(8, $rows.Count)
        $tableH = $pageH - 70 - $y0
        $rowH = [Math]::Floor(($tableH - $headH) / $rowCount)

        $g.DrawRectangle($penLine, $x0, $y0, $totalW, $headH + $rowH * $rowCount)
        $cx = $x0
        for ($i = 0; $i -lt $colW.Count - 1; $i++) {
            $cx += $colW[$i]
            $g.DrawLine($penLine, $cx, $y0, $cx, $y0 + $headH + $rowH * $rowCount)
        }
        $g.DrawLine($penLine, $x0, $y0 + $headH, $x0 + $totalW, $y0 + $headH)
        for ($ri = 1; $ri -lt $rowCount; $ri++) {
            $yy = $y0 + $headH + $rowH * $ri
            $g.DrawLine($penLine, $x0, $yy, $x0 + $totalW, $yy)
        }

        $heads = @('订单号', '材料名称', '规格', '单位', '请领数量', '实发数量', '备注')
        $cx = $x0
        for ($i = 0; $i -lt $heads.Count; $i++) {
            $rect = New-Object System.Drawing.RectangleF($cx, ($y0 + 9), ($colW[$i]), ($headH - 12))
            $g.DrawString($heads[$i], $fontHead, $black, $rect, $fmtC)
            $cx += $colW[$i]
        }

        for ($ri = 0; $ri -lt $rowCount; $ri++) {
            $yy = $y0 + $headH + $rowH * $ri
            # 🔴 2026-11-05 用户报障「明细只有 3 行,却给了多行的数据」:
            #   以前空行也填「订单号」(GD-…-#1),看上去像 8 行明细全是同一张单。
            #   现在**只有真有数据的行**才写订单号,空行就是空格子(纸表留白)。
            $vals = @('', '', '', '', '', '', '')
            if ($ri -lt $rows.Count) {
                $row = $rows[$ri]
                $q1 = ''
                $q2 = ''
                if ([double]$row.'请领数量' -gt 0) { $q1 = [string]$row.'请领数量' }
                if ([double]$row.'实发数量' -gt 0) { $q2 = [string]$row.'实发数量' }
                $vals = @(($script:pWoNo + $script:pLine), [string]$row.'材料名称', [string]$row.'规格', [string]$row.'单位', $q1, $q2, [string]$row.'备注')
            }
            $cx = $x0
            for ($i = 0; $i -lt 7; $i++) {
                # 🔴 2026-11-06 第二轮(用户报「报表还是会省略,如计量单位这边」):
                #   以前只给「材料名称/规格」折行,**其它列仍单行硬裁** —— 单位 "支（成型前）" 6 个字
                #   在 45(≈11mm) 里只放得下 "支 (",后半截直接没了。
                #   现在**每一列都走同一套自适应**:先按 8→7.5→7→6.5→6 逐级缩字号,还放不下就折成 2 行。
                #   这样任何列都不会再出现"被省略"的情况。
                $avail = [double]($colW[$i] - 10)
                $drawn = $false
                foreach ($f in $cellFonts) {
                    if ($g.MeasureString($vals[$i], $f).Width -le $avail) {
                        $rect = New-Object System.Drawing.RectangleF(($cx + 4), ($yy + 6), ($colW[$i] - 8), ($rowH - 9))
                        $g.DrawString($vals[$i], $f, $black, $rect, $fmtL)
                        $drawn = $true
                        break
                    }
                }
                if (-not $drawn -and $vals[$i]) {
                    $small = $cellFonts[$cellFonts.Count - 1]
                    $lines = Get-CellLines $g $vals[$i] $small $avail 2
                    $ly = $yy + 5
                    foreach ($ln in $lines) {
                        $rect = New-Object System.Drawing.RectangleF(($cx + 4), $ly, ($colW[$i] - 8), 12)
                        $g.DrawString($ln, $small, $black, $rect, $fmtL)
                        $ly += 10
                    }
                }
                $cx += $colW[$i]
            }
        }

        # ⑤ 底部四栏签名
        $fy = $y0 + $headH + $rowH * $rowCount + 20
        $g.DrawString('部门主管:', $fontFoot, $gray, 26, $fy)
        $g.DrawString('仓库主管:', $fontFoot, $gray, 230, $fy)
        $g.DrawString('领料人:', $fontFoot, $gray, 440, $fy)
        $g.DrawString('仓管员:', $fontFoot, $gray, 630, $fy)

        # ⑥ 还有下一行没画完 ⇒ 让打印框架再调一次本回调(续页,抬头/表格线/签名都重画)
        if (($pageIdx + 1) -lt [int]$script:pTotalPages) { $e.HasMorePages = $true }

        $penLine.Dispose(); $fmtC.Dispose(); $fmtL.Dispose(); $fmtW.Dispose(); $cellFonts | ForEach-Object { $_.Dispose() }
        $fontTitle.Dispose(); $fontNo.Dispose(); $fontHead.Dispose(); $fontCell.Dispose(); $fontFoot.Dispose()
        } catch {
            $msg = $_.Exception.Message
            Say "[绘制失败] $msg" 'Red'
            Say "  堆栈: $($_.ScriptStackTrace)" 'DarkYellow'
            throw
        }
    })
    $doc.Print()
    if ($qrImg) { $qrImg.Dispose() }
}

function Invoke-PrintJob {
    param($Job)

    $title    = [string]($Job.'标题');       if (-not $title)  { $title = '生产领料单' }
    $woNo     = [string]($Job.'工单号')
    $woLine   = [int]($Job.'工单行号')
    $product  = [string]($Job.'产品名称')
    $spec     = [string]($Job.'规格型号')
    $qrText   = [string]($Job.'二维码内容')
    $qrImage  = [string]($Job.'二维码图')
    # 纸面抬头与明细(2026-11-02):没有就留空,表格照画(纸表永远有格子)
    $outNo    = [string]($Job.'领料单号')
    $dept     = [string]($Job.'领料部门')
    $printDt  = [string]($Job.'打印日期')
    if (-not $printDt) { $printDt = (Get-Date -Format 'yyyy-MM-dd') }
    $rows     = @()
    if ($Job.'明细') { $rows = @($Job.'明细') }
    # 纸张(2026-11-05):由「自动打印」页按**每台电脑**配置,服务端派单时随任务下发(A5/A4)。
    # 缺省 A5(中一刀),与以前完全一致。
    $paper    = [string]($Job.'纸张')
    $printerN = [string]($Job.'printer')
    if (-not $qrText) {
        if ($woNo) {
            $n = 1000 + [Math]::Max(1, $woLine)
            $qrText = "0@$woNo@$n"
        } else {
            throw '缺少打印内容(二维码内容与工单号都为空)'
        }
    }
    if (-not $printerN) { $printerN = $Printer }
    if (-not $printerN) { $printerN = Get-SystemPrinterName }

    # 落 PDF 的公共动作(Printer 模式失败后也复用它做兜底)
    $doPdf = {
        if (-not (Test-Path $PdfDir)) { New-Item -ItemType Directory -Path $PdfDir -Force | Out-Null }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $safeWo = ($woNo -replace '[^\w\-\.]', '_')
        if (-not $safeWo) { $safeWo = 'label' }
        $name = "$safeWo" + "_L$woLine" + "_$stamp.pdf"
        $path = Join-Path $PdfDir $name
        Send-LabelToPrinter -Title $title -WoNo $woNo -WoLine $woLine -ProductName $product `
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PdfPath $path `
                            -OutNo $outNo -Dept $dept -PrintDate $printDt -Rows $rows -Paper $paper
        return $path
    }

    # ── Pdf 模式:不出纸,只落 PDF 文件 ──────────────────────────────
    # 文件名用「工单号_行号_时间戳」:ASCII 安全(工单号本身是 GD-/LL- 这种),
    # 不用中文/空格,免得到 Windows 路径或后续脚本里出转义问题。
    if ($Mode -eq 'Pdf') {
        $pdfPath = & $doPdf
        return @{ ok = $true; mode = 'pdf'; pdfPath = $pdfPath; pdfDir = $PdfDir }
    }

    # ── Printer 模式:真出纸 ────────────────────────────────────────
    if ($Mode -eq 'Printer') {
        Send-LabelToPrinter -Title $title -WoNo $woNo -WoLine $woLine -ProductName $product `
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PrinterName $printerN `
                            -OutNo $outNo -Dept $dept -PrintDate $printDt -Rows $rows -Paper $paper
        return @{ ok = $true; mode = 'printer'; printer = $printerN }
    }

    # ── Auto(默认):有**真打印机**就出纸,否则/失败就落 PDF 兜底 ──────────
    # 用户口径(2026-11-01):「打印机和 pdf 可以实现切换(没链接打印机的话,pdf 是兜底)」。
    # 判"能不能打"两条:① 排除虚拟打印机(PDF/XPS/OneNote/Fax,它们不落纸);
    # ② 真打一次,失败(离线/缺纸/驱动报错)也降级 —— 现场不会"点了没反应"。
    try {
        $real = Get-RealPrinterName -Prefer $printerN
        if (-not $real) {
            Say '[兜底] 本机没有可用打印机,改落 PDF' 'Yellow'
            $pdfPath = & $doPdf
            return @{ ok = $true; mode = 'pdf'; pdfPath = $pdfPath; pdfDir = $PdfDir; fallback = 'no-printer' }
        }
        Send-LabelToPrinter -Title $title -WoNo $woNo -WoLine $woLine -ProductName $product `
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PrinterName $real `
                            -OutNo $outNo -Dept $dept -PrintDate $printDt -Rows $rows -Paper $paper
        return @{ ok = $true; mode = 'printer'; printer = $real }
    } catch {
        $why = $_.Exception.Message
        Say "[兜底] 打印失败,改落 PDF:$why" 'Yellow'
        $pdfPath = & $doPdf
        return @{ ok = $true; mode = 'pdf'; pdfPath = $pdfPath; pdfDir = $PdfDir; fallback = $why }
    }
}

function Write-JsonResponse {
    param($Response, $Object, [int]$Status = 200)
    $Response.StatusCode = $Status
    $Response.ContentType = 'application/json; charset=utf-8'
    $body = $Object | ConvertTo-Json -Compress
    $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
    $Response.OutputStream.Write($buf, 0, $buf.Length)
}

# ── HTTP 服务 ─────────────────────────────────────────────────────

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Say "[FAIL] 端口 $Port 起不来(被占用或权限不足):$($_.Exception.Message)" 'Red'
    Say '       可能已有一个代理在跑;如需换端口,同时改 src/business/printStation.js 的 AGENT_URL。'
    exit 1
}
# ══════════════════════════════════════════════════════════════════════
# 🔴 2026-11-03 「代理主动去服务器拉任务」—— 绕开浏览器的 localhost 限制
# ══════════════════════════════════════════════════════════════════════
# 为什么必须这么做:系统上服务器后,页面地址是**公网 HTTP**(如 http://36.140.66.163:8090),
#   而代理在 127.0.0.1。Chrome 对这种组合的报错是:
#     "The request client is not a secure context and the resource is in
#      more-private address space `loopback`"
#   —— 连 CORS 预检都不发,直接拒。补 PNA 头也没用,因为卡在"非安全上下文"这一关。
#   ⇒ 与其跟浏览器较劲,不如让代理**自己**登录服务器、轮询 /pending、打印、回 /ack。
#     浏览器页面那套(点开关、看队列)仍然保留,只是不再承担"取任务"的职责。
#
# 用法:powershell -File print-agent.ps1 -Server http://36.140.66.163:8090 -User admin -Pass 密码 -Station 一车间打印点
#   给了 -Server 才会启动轮询;不给则维持原来"等页面推任务"的模式。
if ($Server) {
    $srvBase = $Server.TrimEnd('/')
    $compatForJob = Join-Path $script:HereDir 'compat-ps2.ps1'
    $pollArgs = @($compatForJob, $srvBase, $User, $Pass, $Factory, $Station, $Port, $Mode, $PdfDir, $Printer)
    $script:pollJob = Start-Job -ScriptBlock {
        param($Cmp, $Srv, $Usr, $Pwd, $Fac, $Sta, $AgentPort, $ModeX, $PdfDirX, $PrinterX)
        if ($PSVersionTable.PSVersion.Major -lt 3) { . $Cmp }
        # ⚠ 全部走 Invoke-WebRequest + 手动 UTF-8 解码,不用 Invoke-RestMethod ——
        #   实测 PS 5.1 的 Invoke-RestMethod 会把 JSON 响应按 Latin1 解,中文键名全变乱码
        #   ("二维码内容" → "äºç»´ç å å®¹"),后面 $task.'二维码内容' 就永远取不到值,
        #   症状是代理报「缺少打印内容(二维码内容与工单号都为空)」。
        $base = "$Srv/api"
        function Read-Utf8Json($resp) {
            $buf = $resp.RawContentStream.ToArray()
            return ([System.Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json)
        }
        function Api-Get($url, $headers) {
            $r = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 30
            return Read-Utf8Json $r
        }
        function Api-Post($url, $headers, $obj, $timeout) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 8 -Compress))
            $r = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $bytes `
                 -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec $timeout
            return Read-Utf8Json $r
        }
        function Login-Once {
            $o = @{ userName = $Usr; password = $Pwd; factory = $Fac }
            $r = Api-Post "$base/auth/login" @{} $o 30
            return $r.data.token
        }
        $token = ''
        while (-not $token) {
            try { $token = Login-Once; Write-Output "[轮询] 已登录 $Srv(站点:$Sta)" }
            catch { Write-Output "[轮询] 登录失败,10 秒后重试: $($_.Exception.Message)"; Start-Sleep -Seconds 10 }
        }
        $st = [uri]::EscapeDataString($Sta)
        while ($true) {
            $did = $false
            try {
                $hd = @{ Authorization = "Bearer $token" }
                $pend = Api-Get "$base/px/print/pending?station=$st" $hd
                if ($pend.data.task) {
                    $task = $pend.data.task
                    $did = $true
                    $pr = $null
                    try { $pr = Api-Post "http://127.0.0.1:$AgentPort/print" @{} $task 180 }
                    catch { Write-Output "[轮询] 本机打印失败(id=$($task.id)): $($_.Exception.Message)" }
                    $ack = @{
                        taskId = $task.id
                        ok = [bool]($pr -and $pr.ok)
                        printer = $(if ($pr) { [string]$pr.printer } else { '' })
                        标题 = [string]$task.标题
                        工单号 = [string]$task.工单号
                        工单行号 = [int]$task.工单行号
                        发起人 = [string]$task.发起人
                    }
                    try {
                        Api-Post "$base/px/print/ack" $hd $ack 30 | Out-Null
                        Write-Output "[轮询] 任务 $($task.id) 完成 → $(if ($pr) { $pr.mode } else { '失败' })"
                    } catch { Write-Output "[轮询] 回执失败: $($_.Exception.Message)" }
                }
            } catch {
                $msg = "$($_.Exception.Message)"
                if ($msg -match '401|403|未授权|Forbidden') {
                    try { $token = Login-Once; Write-Output '[轮询] token 过期,已重新登录' } catch { }
                }
            }
            # 🔴 2026-11-06 用户口径「多单生成没有连续打印」:一批 9 张单以前要 9×4 秒才轮到底。
            #   改法:刚打完一张就**立刻取下一张**(不再固定睡 4 秒);队列空了才等 4 秒。
            if ($did) { Start-Sleep -Milliseconds 300 } else { Start-Sleep -Seconds 4 }
        }
    } -ArgumentList $pollArgs
    Say "[轮询] 已启动:每 4 秒去 $srvBase 拉一次任务(站点:$Station)" 'Cyan'
    Say '[轮询] 这个模式下**不需要**浏览器页面开着;页面只用来开关/看队列。' 'DarkGray'
}


$defaultPrinter = Get-SystemPrinterName
$effective = if ($Printer) { $Printer } elseif ($defaultPrinter) { "$defaultPrinter(系统默认)" } else { '(未检测到默认打印机!)' }
Say ''
Say '════════════════════════════════════════════════════════' 'Cyan'
Say " YINJIA-MES 本地打印代理 v$AgentVersion" 'Cyan'
Say " 监听: $prefix" 'Green'
Say " 打印机: $effective"
Say ' 按 Ctrl+C 退出' 'DarkGray'
Say '════════════════════════════════════════════════════════' 'Cyan'
Say ''

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()      # 阻塞等请求
        $req = $ctx.Request
        $res = $ctx.Response
        # 网页与本机代理不同源 ⇒ 必须放 CORS,否则 fetch 被浏览器拦掉
        $origin = $req.Headers['Origin']
        if ($origin) { $res.Headers.Add('Access-Control-Allow-Origin', $origin) }
        else { $res.Headers.Add('Access-Control-Allow-Origin', '*') }
        $res.Headers.Add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        # 🔴 2026-11-03 关键:页面开在**服务器地址**上(http://36.140.66.163:8090)时,
        #   浏览器把它当"公网页面",而代理在 127.0.0.1 —— 这属于 Chrome 的
        #   Private Network Access:公网→本机的请求**必须**由本机服务显式许可,
        #   否则 fetch 直接被拦,页面永远显示「代理未连接」(实测就是这个原因)。
        #   许可方式 = 响应里带 Access-Control-Allow-Private-Network: true。
        $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network')
        $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')
        $res.Headers.Add('Access-Control-Max-Age', '600')

        try {
            $path = $req.Url.AbsolutePath

            if ($req.HttpMethod -eq 'OPTIONS') {
                $res.StatusCode = 204
            }
            elseif ($req.HttpMethod -eq 'GET' -and $path -eq '/health') {
                # mode 让网页知道这台代理现在是"真出纸"还是"落 PDF"
                Write-JsonResponse $res @{ ok = $true; version = $AgentVersion; mode = $Mode; printer = $effective; pdfDir = $PdfDir }
            }
            elseif ($path -eq '/config') {
                # 运行时配置(2026-11-01):让网页能改**出纸方式**和 **PDF 存放目录**,
                # 不用去动命令行参数、也不用重启代理。改完立即生效,但**不写注册表** ——
                # 开机自启仍按当初 -Install 时的那套参数,避免网页误改把自启搞乱。
                if ($req.HttpMethod -eq 'GET') {
                    Write-JsonResponse $res @{ ok = $true; mode = $Mode; pdfDir = $PdfDir; printer = $effective }
                } else {
                    $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                    $raw = $reader.ReadToEnd()
                    $reader.Close()
                    $cfg = $raw | ConvertFrom-Json
                    if ($cfg.PSObject.Properties.Name -contains 'mode') {
                        $m = [string]$cfg.mode
                        if (@('Auto', 'Printer', 'Pdf') -contains $m) { $script:Mode = $m }
                    }
                    if ($cfg.PSObject.Properties.Name -contains 'pdfDir') {
                        $d = [string]$cfg.pdfDir
                        if ($d) {
                            if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
                            $script:PdfDir = $d
                        } else {
                            # 传空 = 还原脚本默认目录(不能让"清空"变成"什么都不做",那样清不掉)
                            $script:PdfDir = Join-Path (Split-Path -Parent $ScriptPath) 'print-out'
                        }
                    }
                    Write-JsonResponse $res @{ ok = $true; mode = $Mode; pdfDir = $PdfDir; printer = $effective }
                    Say "[配置] mode=$Mode pdfDir=$PdfDir" 'Cyan'
                }
            }
            elseif ($req.HttpMethod -eq 'POST' -and $path -eq '/print') {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $raw = $reader.ReadToEnd()
                $reader.Close()
                $job = $raw | ConvertFrom-Json
                $r = Invoke-PrintJob -Job $job
                Write-JsonResponse $res @{ ok = $true; mode = $r.mode; printer = $r.printer; pdfPath = $r.pdfPath }
                if ($r.mode -eq 'pdf') {
                    Say "[PDF ] $($job.'工单号') #$($job.'工单行号') -> $($r.pdfPath)" 'Cyan'
                } else {
                    Say "[打印] $($job.'工单号') #$($job.'工单行号') -> $($r.printer)" 'Green'
                }
            }
            elseif ($req.HttpMethod -eq 'POST' -and $path -eq '/test') {
                $r = Invoke-PrintJob -Job (New-Object PSObject -Property @{
                    标题 = '打印代理测试'
                    工单号 = 'TEST-0001'
                    工单行号 = 1
                    产品名称 = '测试标签'
                    规格型号 = '75x100mm'
                    二维码内容 = '0@TEST-0001@1001'
                })
                Write-JsonResponse $res @{ ok = $true; mode = $r.mode; printer = $r.printer; pdfPath = $r.pdfPath }
                if ($r.mode -eq 'pdf') { Say "[测试] 已生成测试 PDF: $($r.pdfPath)" 'Yellow' }
                else { Say '[测试] 已发送一张测试标签' 'Yellow' }
            }
            else {
                Write-JsonResponse $res @{ ok = $false; error = 'not found' } 404
            }
        } catch {
            # 单次打印失败不影响代理继续跑:把错误回给网页,让人在界面上看得见
            Say "[错误] $($_.Exception.Message)" 'Red'
            try { Write-JsonResponse $res @{ ok = $false; error = $_.Exception.Message } 500 } catch { }
        } finally {
            try { $res.Close() } catch { }
        }
    }
} finally {
    try { $listener.Stop(); $listener.Close() } catch { }
    Say ''
    Say '代理已停止。' 'DarkGray'
}
