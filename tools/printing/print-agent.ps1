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
    [string]$Printer = ''
)

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.0.0'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'
$ScriptPath = $PSCommandPath

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
    $cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ScriptPath"" -Port $Port"
    New-Item -Path $RunKey -Force | Out-Null
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
        [string]$PrinterName
    )
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop

    # ⚠ 先算成变量:PowerShell 的 "…$(if (…) {"…"} else {…})…" 嵌套双引号极易被咬掉,
    #   实测报「字符串缺少终止符」。一律先赋值再插值。
    $lineText = ''
    if ($WoLine -gt 0) { $lineText = '#' + $WoLine }

    $lines = @(
        $Title,
        '',
        ('工单号: '   + $WoNo),
        ('工单行号: ' + $lineText),
        ('产　　品: ' + $ProductName),
        ('规　　格: ' + $Spec),
        '',
        '扫码内容(与工单二维码同值):',
        $QrText
    )

    $doc = New-Object System.Drawing.Printing.PrintDocument
    if ($PrinterName) { $doc.PrinterSettings.PrinterName = $PrinterName }
    if (-not $doc.PrinterSettings.IsValid) {
        throw "打印机不可用:[$PrinterName](检查打印机名称,或在网页里留空使用系统默认打印机)"
    }
    $doc.DocumentName = "YINJIA-MES $Title $WoNo"
    # StandardPrintController = 不显示进度对话框 ⇒ 真静默
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

    $script:labelLines = $lines
    $doc.add_PrintPage({
        param($sender, $e)
        $font     = New-Object System.Drawing.Font('Microsoft YaHei', 13)
        $fontBig  = New-Object System.Drawing.Font('Microsoft YaHei', 18, [System.Drawing.FontStyle]::Bold)
        $y = 50
        for ($i = 0; $i -lt $script:labelLines.Count; $i++) {
            $l = $script:labelLines[$i]
            $f = if ($i -eq 0) { $fontBig } else { $font }
            $e.Graphics.DrawString($l, $f, [System.Drawing.Brushes]::Black, 50, $y)
            $y += if ($i -eq 0) { 46 } else { 30 }
        }
        $font.Dispose()
        $fontBig.Dispose()
    })
    $doc.Print()
}

function Invoke-PrintJob {
    param($Job)

    $title    = [string]($Job.'标题');       if (-not $title)  { $title = '生产领料单' }
    $woNo     = [string]($Job.'工单号')
    $woLine   = [int]($Job.'工单行号')
    $product  = [string]($Job.'产品名称')
    $spec     = [string]($Job.'规格型号')
    $qrText   = [string]($Job.'二维码内容')
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

    Send-LabelToPrinter -Title $title -WoNo $woNo -WoLine $woLine -ProductName $product `
                        -Spec $spec -QrText $qrText -PrinterName $printerN
    return @{ ok = $true; mode = 'text'; printer = $printerN }
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
                Write-JsonResponse $res @{ ok = $true; version = $AgentVersion; printer = $effective }
            }
            elseif ($req.HttpMethod -eq 'POST' -and $path -eq '/print') {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $raw = $reader.ReadToEnd()
                $reader.Close()
                $job = $raw | ConvertFrom-Json
                $r = Invoke-PrintJob -Job $job
                Write-JsonResponse $res @{ ok = $true; mode = $r.mode; printer = $r.printer }
                Write-Host "[打印] $($job.'工单号') #$($job.'工单行号') → $($r.printer)" -ForegroundColor Green
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
                Write-JsonResponse $res @{ ok = $true; mode = $r.mode; printer = $r.printer }
                Write-Host '[测试] 已发送一张测试标签' -ForegroundColor Yellow
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
