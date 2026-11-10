<#
  卸载打印代理 —— 双击「卸载.bat」调用。

  ⚠ 为什么不按端口号找进程(2026-11-01 踩坑):
  PowerShell 的 `HttpListener` 底层走 Windows 的 **HTTP.sys 内核驱动**,
  `netstat -ano | findstr :18777` 里那一行的 PID 是 **4(System)** 而不是我们的 PowerShell 进程 ——
  按它 taskkill 要么失败、要么去动 System,而真正的代理**根本没被杀掉**(实测就是这样)。
  正确做法:按**命令行**找跑着 print-agent.ps1 的 powershell 进程。
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# ── Win7 / 老 PowerShell 兼容(2026-11-10,现场 Win7 报 0x1F 后加)────────────────
# 现场症状(Win7 + PS 5.1,安装窗口里):
#   Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
#                occurred when writing console output buffer at current cursor position.
# 触发条件 = chcp 65001 + 某些 Win7 控制台/远程会话下控制台输出缓冲区不可写;Write-Host 一抛,
# $ErrorActionPreference='Stop' 就把安装打断。下面统一走 Say:
#   先试带颜色 Write-Host → 失败退 [Console]::Out → 再失败只写日志,**绝不因输出中断安装**。
$script:SayLog = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'uninstall.log' } else { Join-Path (Get-Location).Path 'uninstall.log' }
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

$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'

Say ''
Say '=== 银嘉 MES · 打印代理卸载 ===' 'Cyan'
Say ''

# ── ① 取消开机自启 ────────────────────────────────────────────────
$has = Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
if ($has) {
    Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
    Say '[OK] 已取消开机自启' 'Green'
} else {
    Say '[--] 没有开机自启项' 'DarkGray'
}

# ── ② 结束代理进程(按命令行匹配,不按端口) ──────────────────────
$killed = 0
try {
    # Win7:用 WMI(Get-WmiObject)而不是 CIM,CIM 在 Win7 需要额外服务/可能不可用
    $procs = Get-WmiObject Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
             Where-Object { $_.CommandLine -and $_.CommandLine -match 'print-agent\.ps1' -and $_.ProcessId -ne $PID }
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Say "[OK] 已结束代理进程 PID $($p.ProcessId)" 'Green'
            $killed++
        } catch {
            Say "[WARN] 无法结束 PID $($p.ProcessId):$($_.Exception.Message)" 'Yellow'
        }
    }
} catch {
    Say "[WARN] 查找进程失败:$($_.Exception.Message)" 'Yellow'
}
if ($killed -eq 0) { Say '[--] 没有正在运行的代理进程' 'DarkGray' }

# ── ③ 复核 ────────────────────────────────────────────────────────
Start-Sleep -Milliseconds 800
$alive = $false
try {
    Invoke-WebRequest -Uri 'http://127.0.0.1:18777/health' -TimeoutSec 3 -UseBasicParsing | Out-Null
    $alive = $true
} catch { $alive = $false }

Say ''
if ($alive) {
    Say '[WARN] 18777 端口仍有响应,可能还有别的实例在跑。' 'Yellow'
    Say '       请打开任务管理器结束残留的 powershell 进程,或重启电脑。'
} else {
    Say '卸载完成。代理已停止,开机也不会再自动启动。' 'Green'
}
Say '已生成的 PDF 文件不会被删除,需要的话请自己清理。'
Say ''
