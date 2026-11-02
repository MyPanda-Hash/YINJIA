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
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'

Write-Host ''
Write-Host '=== 银嘉 MES · 打印代理卸载 ===' -ForegroundColor Cyan
Write-Host ''

# ── ① 取消开机自启 ────────────────────────────────────────────────
$has = Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
if ($has) {
    Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue
    Write-Host '[OK] 已取消开机自启' -ForegroundColor Green
} else {
    Write-Host '[--] 没有开机自启项' -ForegroundColor DarkGray
}

# ── ② 结束代理进程(按命令行匹配,不按端口) ──────────────────────
$killed = 0
try {
    $procs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
             Where-Object { $_.CommandLine -and $_.CommandLine -match 'print-agent\.ps1' -and $_.ProcessId -ne $PID }
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-Host "[OK] 已结束代理进程 PID $($p.ProcessId)" -ForegroundColor Green
            $killed++
        } catch {
            Write-Host "[WARN] 无法结束 PID $($p.ProcessId):$($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[WARN] 查找进程失败:$($_.Exception.Message)" -ForegroundColor Yellow
}
if ($killed -eq 0) { Write-Host '[--] 没有正在运行的代理进程' -ForegroundColor DarkGray }

# ── ③ 复核 ────────────────────────────────────────────────────────
Start-Sleep -Milliseconds 800
$alive = $false
try {
    Invoke-WebRequest -Uri 'http://127.0.0.1:18777/health' -TimeoutSec 3 -UseBasicParsing | Out-Null
    $alive = $true
} catch { $alive = $false }

Write-Host ''
if ($alive) {
    Write-Host '[WARN] 18777 端口仍有响应,可能还有别的实例在跑。' -ForegroundColor Yellow
    Write-Host '       请打开任务管理器结束残留的 powershell 进程,或重启电脑。'
} else {
    Write-Host '卸载完成。代理已停止,开机也不会再自动启动。' -ForegroundColor Green
}
Write-Host '已生成的 PDF 文件不会被删除,需要的话请自己清理。'
Write-Host ''
