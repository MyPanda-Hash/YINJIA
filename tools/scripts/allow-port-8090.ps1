# allow-port-8090.ps1 — 放行 MES 后端 8090(2026-10-21)
#
# 为什么要它:Windows 防火墙默认拦入站。手机要连开发机的
#   http://<本机IP>:8090 时,若没有入站放行规则,手机侧表现为
#   「连不上/工厂一直加载/正在连接服务」——和端口写错一模一样,很难分辨。
#
# 用法(二选一):
#   ① 右键「以管理员身份运行」allow-port-8090.bat
#   ② PowerShell(管理员)里执行:
#      powershell -ExecutionPolicy Bypass -File tools\scripts\allow-port-8090.ps1
#
# 撤销:Remove-NetFirewallRule -DisplayName "YINJIA-MES 8090"

$ErrorActionPreference = 'Stop'
$ruleName = 'YINJIA-MES 8090'
$port = 8090

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host '[需要管理员] 请右键「以管理员身份运行」allow-port-8090.bat,或在本窗口用管理员身份重开。' -ForegroundColor Yellow
  exit 1
}

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "[已存在] 规则「$ruleName」—— 不重复添加。" -ForegroundColor Green
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $port -Profile Any -Description '银嘉 MES 后端(手机/其他电脑访问)' | Out-Null
  Write-Host "[已添加] 入站放行 TCP $port(所有网络类型)。" -ForegroundColor Green
}

# 顺便把本机各网卡 IP 打出来,方便填到 App 的「服务器地址」
Write-Host ''
Write-Host '本机可用地址(App 里填 http://<下面某个IP>:8090):'
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { Write-Host ("  http://{0}:{1}    [{2}]" -f $_.IPAddress, $port, $_.InterfaceAlias) }
