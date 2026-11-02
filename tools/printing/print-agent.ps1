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
    [string]$PdfDir = ''
)

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.1.0'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'
$ScriptPath = $PSCommandPath

# PDF 输出目录:默认放在脚本同级的 print-out\(不污染仓库根)
if (-not $PdfDir) { $PdfDir = Join-Path (Split-Path -Parent $ScriptPath) 'print-out' }

# ── 自启注册 / 注销 ────────────────────────────────────────────────
if ($Uninstall) {
    if (Test-Path $RunKey) {
        Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
        Write-Host "[OK] 已取消开机自启: $RunName"
    }
    Write-Host '代理进程如仍在运行,请在任务管理器里结束对应 powershell 进程(或重启电脑)。'
    return
}

if ($Install) {
    $cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ScriptPath"" -Port $Port -Mode $Mode"
    # ⚠ 只在**不存在**时创建:对已存在的注册表键用 `New-Item -Force` 会抛
    #   「The data area passed to a system call is too small」(2026-11-01 实测踩到,
    #   直接导致 -Install 整个失败、代理也没起来)。Run 键几乎必然存在,所以这里基本不建。
    if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
    Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
    Write-Host "[OK] 已设为开机自启: $RunName"
    Write-Host "     $cmd"
    Write-Host '     下次开机会自动在后台运行;现在先手动跑一次即可生效。'
    Write-Host ''
}

# ── 打印机 ────────────────────────────────────────────────────────

function Get-SystemPrinterName {
    try {
        $p = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
             Where-Object { $_.Default -eq $true } | Select-Object -First 1
        if ($p) { return $p.Name }
    } catch { }
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
    try {
        $all = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop |
               Where-Object { $_.WorkOffline -ne $true }
        foreach ($p in $all) {
            if (-not (Test-VirtualPrinter $p.Name)) { return $p.Name }
        }
    } catch { }
    return ''
}

<#
  把一张工单标签送到打印机(**不弹任何对话框**)。

  用 System.Drawing.Printing —— .NET 自带能力,不需要装任何东西。
  真实打印机 / XPS / PDF 虚拟打印机都一样对待:PrintController 设成 StandardPrintController,
  这样连"正在打印…"进度框都不会冒出来,才是真正的静默。
#>
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
        [string]$QrImage = ''
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
            Write-Host "[WARN] 二维码图解码失败,本轮只打文字: $($_.Exception.Message)" -ForegroundColor Yellow
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
    $script:W100 = 827   # 横向 210mm ≈ 8.27in(1/100 英寸)
    $script:H100 = 583   # 纵向 148mm ≈ 5.83in(A5 短边)
    try {
        $a5 = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq 'A5' } | Select-Object -First 1
        if (-not $a5) { $a5 = $doc.PrinterSettings.PaperSizes | Where-Object { $_.PaperName -match 'A5' } | Select-Object -First 1 }
        if ($a5) {
            $doc.DefaultPageSettings.PaperSize = $a5
            $doc.DefaultPageSettings.Landscape = $true    # 横打:A5 转 90° = 210×148
            $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
        } else {
            Write-Host '[WARN] 打印机没有 A5 纸型,按默认纸输出' -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] 设置中一刀(A5 横版)失败,按默认纸输出: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # 版式数据交给回调(script 作用域,PrintPage 里能读到)
    $script:pTitle = $Title
    $script:pWoNo  = $WoNo
    $script:pLine  = $lineText
    $script:pProd  = $ProductName
    $script:pSpec  = $Spec
    $script:pQrTxt = $QrText
    $script:labelQr = $qrImg

    $doc.add_PrintPage({
        param($sender, $e)
        $g = $e.Graphics
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        $W = $script:W100
        $H = $script:H100

        # ① 边框(红框):二维码与所有文字都画在框内,留 16 的内边距
        $margin = 16
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210, 30, 30), 3)
        $g.DrawRectangle($pen, $margin, $margin, $W - 2 * $margin, $H - 2 * $margin)
        $pen.Dispose()

        $fontTitle = New-Object System.Drawing.Font('Microsoft YaHei', 22, [System.Drawing.FontStyle]::Bold)
        $fontLabel = New-Object System.Drawing.Font('Microsoft YaHei', 12)
        $fontValue = New-Object System.Drawing.Font('Microsoft YaHei', 13, [System.Drawing.FontStyle]::Bold)
        $fontSmall = New-Object System.Drawing.Font('Microsoft YaHei', 10)

        # ② 标题(整幅居中)
        $fmtC = New-Object System.Drawing.StringFormat
        $fmtC.Alignment = [System.Drawing.StringAlignment]::Center
        $titleRect = New-Object System.Drawing.RectangleF(0, 40, $W, 60)
        $g.DrawString($script:pTitle, $fontTitle, [System.Drawing.Brushes]::Black, $titleRect, $fmtC)

        # ③ 二维码:放右侧(框内),200x200
        $qrSize = 200
        $qrX = $W - $margin - 40 - $qrSize
        $qrY = 120
        if ($script:labelQr) {
            $g.DrawImage($script:labelQr, $qrX, $qrY, $qrSize, $qrSize)
        }

        # ④ 左侧字段(标签灰、值黑加粗;用固定列宽对齐,不用制表符)
        $xLabel = 60
        $xValue = 175
        $y = 130
        $rowGap = 52
        $fields = @(
            @{ k = '工单号';   v = $script:pWoNo },
            @{ k = '工单行号'; v = $script:pLine },
            @{ k = '产　　品'; v = $script:pProd },
            @{ k = '规　　格'; v = $script:pSpec }
        )
        foreach ($f in $fields) {
            $g.DrawString(($f.k + ':'), $fontLabel, [System.Drawing.Brushes]::DimGray, $xLabel, $y)
            $g.DrawString($f.v, $fontValue, [System.Drawing.Brushes]::Black, $xValue, $y - 1)
            $y += $rowGap
        }

        # ⑤ 底部扫码内容(框内左下)
        $g.DrawString('扫码内容(与工单二维码同值):', $fontSmall, [System.Drawing.Brushes]::DimGray, $xLabel, $H - 110)
        $g.DrawString($script:pQrTxt, $fontSmall, [System.Drawing.Brushes]::Black, $xLabel, $H - 82)

        $fmtC.Dispose()
        $fontTitle.Dispose(); $fontLabel.Dispose(); $fontValue.Dispose(); $fontSmall.Dispose()
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
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PdfPath $path
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
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PrinterName $printerN
        return @{ ok = $true; mode = 'printer'; printer = $printerN }
    }

    # ── Auto(默认):有**真打印机**就出纸,否则/失败就落 PDF 兜底 ──────────
    # 用户口径(2026-11-01):「打印机和 pdf 可以实现切换(没链接打印机的话,pdf 是兜底)」。
    # 判"能不能打"两条:① 排除虚拟打印机(PDF/XPS/OneNote/Fax,它们不落纸);
    # ② 真打一次,失败(离线/缺纸/驱动报错)也降级 —— 现场不会"点了没反应"。
    try {
        $real = Get-RealPrinterName -Prefer $printerN
        if (-not $real) {
            Write-Host '[兜底] 本机没有可用打印机,改落 PDF' -ForegroundColor Yellow
            $pdfPath = & $doPdf
            return @{ ok = $true; mode = 'pdf'; pdfPath = $pdfPath; pdfDir = $PdfDir; fallback = 'no-printer' }
        }
        Send-LabelToPrinter -Title $title -WoNo $woNo -WoLine $woLine -ProductName $product `
                            -Spec $spec -QrText $qrText -QrImage $qrImage -PrinterName $real
        return @{ ok = $true; mode = 'printer'; printer = $real }
    } catch {
        $why = $_.Exception.Message
        Write-Host "[兜底] 打印失败,改落 PDF:$why" -ForegroundColor Yellow
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
    Write-Host "[FAIL] 端口 $Port 起不来(被占用或权限不足):$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '       可能已有一个代理在跑;如需换端口,同时改 src/business/printStation.js 的 AGENT_URL。'
    exit 1
}

$defaultPrinter = Get-SystemPrinterName
$effective = if ($Printer) { $Printer } elseif ($defaultPrinter) { "$defaultPrinter(系统默认)" } else { '(未检测到默认打印机!)' }
Write-Host ''
Write-Host '════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host " YINJIA-MES 本地打印代理 v$AgentVersion" -ForegroundColor Cyan
Write-Host " 监听: $prefix" -ForegroundColor Green
Write-Host " 打印机: $effective"
Write-Host ' 按 Ctrl+C 退出' -ForegroundColor DarkGray
Write-Host '════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host ''

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
        $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

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
                        if ($m -in @('Auto', 'Printer', 'Pdf')) { $script:Mode = $m }
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
                    Write-Host "[配置] mode=$Mode pdfDir=$PdfDir" -ForegroundColor Cyan
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
                    Write-Host "[PDF ] $($job.'工单号') #$($job.'工单行号') -> $($r.pdfPath)" -ForegroundColor Cyan
                } else {
                    Write-Host "[打印] $($job.'工单号') #$($job.'工单行号') -> $($r.printer)" -ForegroundColor Green
                }
            }
            elseif ($req.HttpMethod -eq 'POST' -and $path -eq '/test') {
                $r = Invoke-PrintJob -Job ([pscustomobject]@{
                    标题 = '打印代理测试'
                    工单号 = 'TEST-0001'
                    工单行号 = 1
                    产品名称 = '测试标签'
                    规格型号 = '75x100mm'
                    二维码内容 = '0@TEST-0001@1001'
                })
                Write-JsonResponse $res @{ ok = $true; mode = $r.mode; printer = $r.printer; pdfPath = $r.pdfPath }
                if ($r.mode -eq 'pdf') { Write-Host "[测试] 已生成测试 PDF: $($r.pdfPath)" -ForegroundColor Yellow }
                else { Write-Host '[测试] 已发送一张测试标签' -ForegroundColor Yellow }
            }
            else {
                Write-JsonResponse $res @{ ok = $false; error = 'not found' } 404
            }
        } catch {
            # 单次打印失败不影响代理继续跑:把错误回给网页,让人在界面上看得见
            Write-Host "[错误] $($_.Exception.Message)" -ForegroundColor Red
            try { Write-JsonResponse $res @{ ok = $false; error = $_.Exception.Message } 500 } catch { }
        } finally {
            try { $res.Close() } catch { }
        }
    }
} finally {
    try { $listener.Stop(); $listener.Close() } catch { }
    Write-Host ''
    Write-Host '代理已停止。' -ForegroundColor DarkGray
}
