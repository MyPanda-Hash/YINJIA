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
    [int]$Port = 18777
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$agent = Join-Path $here 'print-agent.ps1'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'

Write-Host ''
Write-Host '=== 银嘉 MES · 打印代理安装 ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $agent)) {
    Write-Host '[FAIL] 同目录下找不到 print-agent.ps1' -ForegroundColor Red
    Write-Host '       请把整个 print-agent 文件夹一起拷贝,不要只拷一个文件。'
    exit 1
}

# ── ① 环境检查 ────────────────────────────────────────────────────
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    Write-Host '[OK] .NET 绘图组件可用(System.Drawing)' -ForegroundColor Green
} catch {
    Write-Host '[FAIL] 这台电脑缺少 .NET 绘图组件,代理无法绘制标签。' -ForegroundColor Red
    Write-Host '       请安装 .NET Framework 4.x 后重试。'
    exit 1
}

$realPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $n = $_.Name
    $n -ne 'Microsoft Print to PDF' -and $n -ne 'Microsoft XPS Document Writer' -and
    $n -ne 'OneNote' -and $n -ne 'OneNote (Desktop)' -and $n -ne 'Fax'
})
if ($realPrinters.Count -eq 0) {
    Write-Host '[提示] 这台电脑没有实体打印机 —— 任务会全部存成 PDF 文件。' -ForegroundColor Yellow
} else {
    $names = ($realPrinters | ForEach-Object { $_.Name }) -join ' / '
    Write-Host "[OK] 检测到打印机:$names" -ForegroundColor Green
    if (-not $Printer) {
        $Printer = $realPrinters[0].Name
        Write-Host "     未指定打印机,默认用第一台:$Printer" -ForegroundColor DarkGray
    }
}

# ── ② 服务器地址与账号(缺了就交互式问) ──────────────────────────
if (-not $Server) {
    Write-Host ''
    Write-Host '请填写 MES 服务器地址(浏览器里访问系统的那个地址):' -ForegroundColor Yellow
    Write-Host '   例:http://36.140.66.163:8090  或  http://192.168.1.10:8090'
    $Server = (Read-Host '服务器地址').Trim()
}
if (-not $Server) { Write-Host '[FAIL] 服务器地址不能为空' -ForegroundColor Red; exit 1 }
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
if (-not $Pass) { Write-Host '[FAIL] 密码不能为空' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[..] 正在验证服务器与账号 ...' -ForegroundColor Cyan
try {
    $json = @{ userName = $User; password = $Pass; factory = $Factory } | ConvertTo-Json -Compress
    $r = Invoke-WebRequest -Uri "$Server/api/auth/login" -Method Post `
         -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) `
         -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec 25
    $txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $obj = $txt | ConvertFrom-Json
    if (-not $obj.data.token) { throw '登录返回里没有 token' }
    Write-Host "[OK] 登录成功($Server)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] 连不上服务器或账号密码不对:$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '       检查:① 服务器地址对不对 ② 这台电脑能不能打开那个网址 ③ 账号密码'
    exit 1
}

# ── ③ 写配置 + 开机自启(参数一起写进去) ─────────────────────────
function Quote([string]$s) { if (-not $s) { return '""' }; return '"' + ($s -replace '"', '') + '"' }
$argParts = @(
    '-ExecutionPolicy Bypass -WindowStyle Hidden -File', (Quote $agent),
    '-Port', "$Port", '-Mode', $Mode,
    '-Server', (Quote $Server),
    '-User', (Quote $User),
    '-Pass', (Quote $Pass),
    '-Factory', (Quote $Factory),
    '-Station', (Quote $Station)
)
if ($Printer) { $argParts += @('-Printer', (Quote $Printer)) }
$cmd = 'powershell.exe ' + ($argParts -join ' ')

$cfgPath = Join-Path $here 'print-agent.config.json'
@{
    server = $Server; user = $User; pass = $Pass; factory = $Factory
    station = $Station; mode = $Mode; printer = $Printer; port = $Port
} | ConvertTo-Json | Out-File -FilePath $cfgPath -Encoding UTF8
Write-Host "[OK] 配置已保存:$cfgPath" -ForegroundColor Green

if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
Write-Host '[OK] 已设为开机自启' -ForegroundColor Green

# ── ④ 启动(已在跑就跳过) ─────────────────────────────────────────
function Test-AgentAlive {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

if (Test-AgentAlive) {
    Write-Host "[OK] 代理已在运行(端口 $Port),本次不重复启动" -ForegroundColor Green
    Write-Host '     (如果刚才改过服务器地址,请先双击「卸载.bat」再重装一次)' -ForegroundColor DarkGray
} else {
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $agent, '-Port', "$Port", '-Mode', $Mode,
        '-Server', $Server, '-User', $User, '-Pass', $Pass, '-Factory', $Factory,
        '-Station', $Station, '-Printer', $Printer
    )
    $ok = $false
    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-AgentAlive) { $ok = $true; break }
    }
    if ($ok) { Write-Host "[OK] 代理已启动(端口 $Port,模式 $Mode)" -ForegroundColor Green }
    else { Write-Host '[WARN] 代理启动后 12 秒内没响应,请手动跑一次 print-agent.ps1 看报错。' -ForegroundColor Yellow }
}

# ── ⑤ 结果 ────────────────────────────────────────────────────────
Write-Host ''
try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5 -UseBasicParsing
    $d = [System.Text.Encoding]::UTF8.GetString($h.RawContentStream.ToArray()) | ConvertFrom-Json
    Write-Host '--- 当前状态 ---' -ForegroundColor Cyan
    Write-Host "  出纸方式: $($d.mode)"
    Write-Host "  打印机  : $($d.printer)"
    Write-Host "  PDF 目录: $($d.pdfDir)"
} catch { }
Write-Host ''
Write-Host '--- 这台电脑的设定 ---' -ForegroundColor Cyan
Write-Host "  服务器  : $Server"
Write-Host "  打印点  : $Station"
Write-Host "  账号    : $User"
Write-Host ''
Write-Host '接下来不用再开浏览器 —— 代理会每 4 秒自己去服务器取任务。' -ForegroundColor Green
Write-Host '(页面「手机扫码 → 自动打印」仍可用来开关/看队列,但不再是必需的。)' -ForegroundColor DarkGray
Write-Host ''
Write-Host '卸载:双击「卸载.bat」' -ForegroundColor DarkGray
Write-Host ''
