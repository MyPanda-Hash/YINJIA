<#
  安装打印代理(客户电脑用)—— 双击「安装.bat」即可,不需要懂命令行。

  它做四件事:
    ① 检查环境(System.Drawing / PowerShell);
    ② 问服务器地址与账号,当场登录验证;
    ③ 写开机自启 + 配置文件;
    ④ 后台启动代理(隐藏窗口),报告状态。

  🔴 2026-11-03 重要变化:系统上服务器后,**页面开在公网地址上时浏览器禁止访问本机代理**
  (非安全上下文 → loopback),页面永远显示「代理未连接」。所以代理改成**自己去服务器拉任务**,
  只需要在这里填一次服务器地址与账号,之后**不再需要浏览器页面开着**。

  重复双击是安全的:已经在跑就只更新自启与配置、不重复起进程。
#>
[CmdletBinding()]
param(
    [string]$Server = '',
    [string]$User = 'admin',
    [string]$Pass = '',
    [string]$Factory = 'YJ',
    [string]$Station = '',
    [ValidateSet('Auto', 'Printer', 'Pdf')]
    [string]$Mode = 'Auto',
    [string]$Printer = '',
    [int]$Port = 18777,
    # 只体检不落地(2026-11-10):检查环境/账号/打印机后退出,不写配置、不设自启、不起代理。
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ── Win7 / 老 PowerShell 兼容(2026-11-10,现场 Win7 报 0x1F 后加)────────────────
# 现场症状(Win7 + PS 5.1,安装窗口里):
#   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
#                occurred when writing console output buffer at current cursor position.
# 触发条件 = chcp 65001 + 某些 Win7 控制台/远程会话下控制台输出缓冲区不可写;Write-Host 一抛,
# $ErrorActionPreference='Stop' 就把安装打断。下面统一走 Say:
#   先试带颜色 Write-Host → 失败退 [Console]::Out → 再失败只写日志,**绝不因输出中断安装**。
$script:SayLog = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'install.log' } else { Join-Path (Get-Location).Path 'install.log' }
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

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$agent = Join-Path $here 'print-agent.ps1'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'

Say ''
Say '=== 银嘉 MES · 打印代理安装 ===' 'Cyan'
Say ''

if (-not (Test-Path $agent)) {
    Say '[FAIL] 同目录下找不到 print-agent.ps1' 'Red'
    Say '       请把整个 print-agent 文件夹一起拷贝,不要只拷一个文件。'
    exit 1
}

# ── ① 环境检查 ────────────────────────────────────────────────────
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    Say '[OK] .NET 绘图组件可用(System.Drawing)' 'Green'
} catch {
    Say '[FAIL] 这台电脑缺少 .NET 绘图组件,代理无法绘制标签。' 'Red'
    Say '       请安装 .NET Framework 4.x 后重试。'
    exit 1
}

# Win7 没有 Get-Printer(Win8+/2012+ 才有 PrintManagement 模块)⇒ 用 .NET 的 InstalledPrinters,
# PS2/.NET2 就有,Win7/Win10 通用。
$virtualPattern = 'PDF|XPS|OneNote|Fax|WPS'   # 虚拟打印机(WPS 的「导出为WPS PDF」现场就中招过)
$virtualPrinters = @()
$realPrinters = @()
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $realPrinters = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters |
        Where-Object { $_ -and ($_ -notmatch $virtualPattern) })
} catch { $realPrinters = @() }
if ($realPrinters.Count -eq 0) {
    Say '[提示] 这台电脑没有实体打印机 —— 任务会全部存成 PDF 文件。' 'Yellow'
} else {
    $names = ($realPrinters -join ' / ')
    Say "[OK] 检测到打印机:$names" 'Green'
    if (-not $Printer) {
        $Printer = $realPrinters[0]
        Say "     未指定打印机,默认用第一台:$Printer" 'DarkGray'
    }
}

# ── ② 服务器地址与账号(缺了就交互式问) ──────────────────────────
if (-not $Server) {
    Say ''
    Say '请填写 MES 服务器地址(浏览器里访问系统的那个地址):' 'Yellow'
    Say '   例:http://36.140.66.163:8090  或  http://192.168.1.10:8090'
    $Server = (Read-Host '服务器地址').Trim()
}
if (-not $Server) { Say '[FAIL] 服务器地址不能为空' 'Red'; exit 1 }
$Server = $Server.TrimEnd('/')

if (-not $Station) {
    $t = (Read-Host '这台打印机的名字(手机端会显示,回车用计算机名)').Trim()
    if ($t) { $Station = $t } else { $Station = $env:COMPUTERNAME }
}

if (-not $Pass) {
    $sec = Read-Host "登录账号 $User 的密码" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $Pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $Pass) { Say '[FAIL] 密码不能为空' 'Red'; exit 1 }

Say ''
Say '[..] 正在验证服务器与账号 ...' 'Cyan'
try {
    $json = @{ userName = $User; password = $Pass; factory = $Factory } | ConvertTo-Json -Compress
    $r = Invoke-WebRequest -Uri "$Server/api/auth/login" -Method Post `
         -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) `
         -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec 25
    $txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $obj = $txt | ConvertFrom-Json
    if (-not $obj.data.token) { throw '登录返回里没有 token' }
    Say "[OK] 登录成功($Server)" 'Green'
} catch {
    # 4xx = 账号/密码不对(不是网络问题),给一句人话(2026-11-10)
    $httpStatus = 0
    try { if ($_.Exception.Response) { $httpStatus = [int]$_.Exception.Response.StatusCode } } catch { }
    if ($httpStatus -eq 401 -or $httpStatus -eq 409) {
        Say "[FAIL] 账号或密码不对(服务器返回 $httpStatus):请重新运行安装,输入正确的 admin 密码。" 'Red'
        exit 1
    }
    Say "[FAIL] 连不上服务器或账号密码不对:$($_.Exception.Message)" 'Red'
    Say '       检查:① 服务器地址对不对 ② 这台电脑能不能打开那个网址 ③ 账号密码'
    exit 1
}

# ── DryRun:只体检不落地(现场排障用)───────────────────────────────
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

# ── ③ 写配置 + 开机自启(参数一起写进去) ─────────────────────────
# 只传 -File:参数全在 print-agent.config.json(避免打印机名/站点名带空格被拆开)
$cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agent + '"'

$cfgPath = Join-Path $here 'print-agent.config.json'
@{
    server = $Server; user = $User; pass = $Pass; factory = $Factory
    station = $Station; mode = $Mode; printer = $Printer; port = $Port
} | ConvertTo-Json | Out-File -FilePath $cfgPath -Encoding UTF8
Say "[OK] 配置已保存:$cfgPath" 'Green'

if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
Say '[OK] 已设为开机自启' 'Green'

# ── ④ 启动(已在跑就跳过) ─────────────────────────────────────────
function Test-AgentAlive {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

if (Test-AgentAlive) {
    Say "[OK] 代理已在运行(端口 $Port),本次不重复启动" 'Green'
    Say '     (如果刚才改过服务器地址,请先双击「卸载.bat」再重装一次)' 'DarkGray'
} else {
    # 只传 -File(参数读 config):带空格/中文的参数用数组传会被拆开
    $agentLog = Join-Path $here 'agent.log'
    $proc = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $agent
    )
    $ok = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-AgentAlive) { $ok = $true; break }
    }
    if ($ok) { Say "[OK] 代理已启动(端口 $Port,模式 $Mode)" 'Green' }
    else {
        Say '[WARN] 代理启动后 20 秒内没响应,下面把它的日志打出来(agent.log 最后 15 行):' 'Yellow'
        try {
            if ($proc -and $proc.HasExited) { Say ("       进程已退出,退出码 " + $proc.ExitCode) 'Yellow' }
        } catch { }
        try {
            if (Test-Path $agentLog) { Get-Content $agentLog -Tail 15 | ForEach-Object { Say ("       " + $_) } }
            else { Say '       同目录还没有 agent.log —— 说明脚本连第一行都没跑起来(权限/杀毒拦截?)' 'Yellow' }
        } catch { }
    }
}

# ── ④b 注册「守护」计划任务(2026-11-16)──────────────────────────
# 为什么加(用户报障:「打印代理的脚本是会掉的吗?客户那边的打印机已经不显示了」):
#   自启只有 HKCU\...\Run —— **只在这个用户登录时起一次**,掉了没人管:
#   注销/换用户、进程被结束、监听线程抛错退出、轮询作业自己死掉(最隐蔽)……
#   现场表现统一是:面板上那台打印机不见了 / 一直离线,而厂里没人知道为什么。
# 现在:注册一个「每 1 分钟」的任务跑 watchdog.ps1 —— 不在就拉起来,活着但轮询停了就重启。
#   · 用 wscript 启动(watchdog-hidden.vbs),不闪黑窗口;
#   · /ru 当前用户 + /it:只在有登录会话时跑(打印本来就要求登录会话;也不需要管理员);
#   · 用 cmd 传参是为了 /tr 里带引号(路径含中文/空格也能存对),win7 的 schtasks 同样适用。
$taskName = 'YinjiaMesPrintAgent-Watch'
$watchVbs = Join-Path $here 'watchdog-hidden.vbs'
if (Test-Path $watchVbs) {
    $trValue = 'wscript.exe \"' + $watchVbs + '\"'
    $cmdLine = 'schtasks /create /tn "' + $taskName + '" /tr "' + $trValue + '" /sc minute /mo 1 /ru "' + $env:USERNAME + '" /it /f'
    $taskOut = ''
    try {
        $taskOut = (& cmd.exe /c $cmdLine 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) {
            Say "[OK] 已注册守护任务(每 1 分钟自检一次:$taskName)" 'Green'
            # 立刻跑一次,别等下一分钟
            & cmd.exe /c ('schtasks /run /tn "' + $taskName + '"') 2>&1 | Out-Null
        } else {
            Say "[WARN] 注册守护任务失败:$taskOut" 'Yellow'
            Say '       不影响本次安装,但代理掉了以后不会自动起来(要人工重起/重启电脑)。' 'Yellow'
        }
    } catch {
        Say "[WARN] 注册守护任务失败:$($_.Exception.Message)" 'Yellow'
    }
} else {
    Say '[WARN] 同目录缺少 watchdog-hidden.vbs,跳过守护任务注册(整个文件夹一起拷贝)' 'Yellow'
}

# ── ⑤ 结果 ────────────────────────────────────────────────────────
Say ''
try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5 -UseBasicParsing
    $d = [System.Text.Encoding]::UTF8.GetString($h.RawContentStream.ToArray()) | ConvertFrom-Json
    Say '--- 当前状态 ---' 'Cyan'
    Say "  出纸方式: $($d.mode)"
    Say "  打印机  : $($d.printer)"
    Say "  PDF 目录: $($d.pdfDir)"
} catch { }
Say ''
Say '--- 这台电脑的设定 ---' 'Cyan'
Say "  服务器  : $Server"
Say "  打印点  : $Station"
Say "  账号    : $User"
Say ''
Say '接下来不用再开浏览器 —— 代理会每 4 秒自己去服务器取任务。' 'Green'
Say '(页面「手机扫码 → 自动打印」仍可用来开关/看队列,但不再是必需的。)' 'DarkGray'
Say ''
Say '卸载:双击「卸载.bat」' 'DarkGray'
Say ''
