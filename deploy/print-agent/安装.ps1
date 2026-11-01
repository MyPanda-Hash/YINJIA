<#
  安装打印代理(客户电脑用)—— 双击「安装.bat」即可,不需要懂命令行。

  它做四件事:
    ① 检查环境(System.Drawing / PowerShell);
    ② 写开机自启(HKCU\...\Run,不需要管理员);
    ③ 立刻在后台启动代理(隐藏窗口);
    ④ 报告结果(含 PDF 目录、检测到的打印机)。

  重复双击是安全的:已经在跑就只更新自启、不重复起进程。
#>
[CmdletBinding()]
param(
    [string]$Port = 18777,
    [ValidateSet('Auto', 'Printer', 'Pdf')]
    [string]$Mode = 'Auto'
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
    Write-Host "[FAIL] 同目录下找不到 print-agent.ps1" -ForegroundColor Red
    Write-Host "       请把整个 print-agent 文件夹一起拷贝,不要只拷一个文件。"
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

$psv = $PSVersionTable.PSVersion
if ($psv.Major -lt 5) {
    Write-Host "[WARN] PowerShell 版本偏低($psv),建议 5.1(Windows 10/11 自带)" -ForegroundColor Yellow
}

$pdfPrinter = Get-Printer -Name 'Microsoft Print to PDF' -ErrorAction SilentlyContinue
if (-not $pdfPrinter) {
    Write-Host '[WARN] 没找到「Microsoft Print to PDF」:自动兜底生成 PDF 会不可用。' -ForegroundColor Yellow
    Write-Host '       可在「控制面板 → 程序和功能 → 启用或关闭 Windows 功能」里勾选它。'
}

$realPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $n = $_.Name
    $n -ne 'Microsoft Print to PDF' -and $n -ne 'Microsoft XPS Document Writer' -and
    $n -ne 'OneNote' -and $n -ne 'OneNote (Desktop)' -and $n -ne 'Fax'
})
if ($realPrinters.Count -eq 0) {
    Write-Host '[提示] 这台电脑没有实体打印机 —— 自动打印会全部存成 PDF 文件。' -ForegroundColor Yellow
} else {
    $names = ($realPrinters | ForEach-Object { $_.Name }) -join ' / '
    Write-Host "[OK] 检测到打印机:$names" -ForegroundColor Green
}

# ── ② 写开机自启 ──────────────────────────────────────────────────
$cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$agent"" -Port $Port -Mode $Mode"
if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
Write-Host '[OK] 已设为开机自启(下次开机自动运行)' -ForegroundColor Green

# ── ③ 启动(已在跑就跳过) ─────────────────────────────────────────
function Test-AgentAlive {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

if (Test-AgentAlive) {
    Write-Host "[OK] 代理已在运行(端口 $Port),本次不重复启动" -ForegroundColor Green
} else {
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $agent, '-Port', "$Port", '-Mode', $Mode
    )
    # 等它起来(最多 10 秒)
    $ok = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-AgentAlive) { $ok = $true; break }
    }
    if ($ok) { Write-Host "[OK] 代理已启动(端口 $Port,模式 $Mode)" -ForegroundColor Green }
    else {
        Write-Host '[WARN] 代理启动后 10 秒内没响应,请手动双击 print-agent.ps1 看报错。' -ForegroundColor Yellow
    }
}

# ── ④ 结果 ────────────────────────────────────────────────────────
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
Write-Host '下一步:' -ForegroundColor Cyan
Write-Host '  1) 用浏览器打开 MES → 菜单「手机扫码 → 自动打印」'
Write-Host '  2) 打开「自动打印」开关,这台电脑就会接单'
Write-Host '  3) 这个页面保持开着(关掉就不再取任务)'
Write-Host ''
Write-Host '卸载:双击「卸载.bat」' -ForegroundColor DarkGray
Write-Host ''
