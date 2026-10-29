# hindsight-follow-dsh.ps1
#
# 目的(用户 2026-10-25 口径):
#   「取消开机自启动,改为打开 DeepSeek Harness 再启动,关闭 DeepSeek Harness 就停止」
#
# 做法:本脚本作为一个**隐藏常驻的监督进程**运行,不做任何业务:
#   · 每 5 秒看一次 DeepSeek Harness 主窗口进程在不在;
#   · 不在   -> 若 hindsight 守护还活着,精确杀掉整棵进程树(按端口/命令行定位,不误杀别的 python);
#   · 在     -> 若守护没起,用官方 `hindsight-embed.exe daemon start` 拉起。
#
# 为什么不用 `daemon stop`:
#   2026-10-25 实测该命令在 Windows 上会报 "Could not find PID for port 9077" 且**杀不掉进程**
#   (返回 Error、进程与端口都还在)。所以停止改用 taskkill /T 按树根杀,实测三个子进程全清、
#   端口释放、状态变 not running。
#
# 为什么监督进程自己也要能被关掉:
#   它不注册开机自启,只在 DSH 启动后由 DSH 会话(或手动)拉起;DSH 关掉后它自己会继续存活
#   直到下一次巡检发现 DSH 不在 -> 停掉 hindsight -> 自己退出。这样不会留僵尸。

param(
  [int]$PollSeconds = 5,
  [switch]$Once          # 只跑一轮(自检用)
)

$ErrorActionPreference = 'Continue'
$logDir = 'C:\Users\x1787\.dsh\logs'
$log = Join-Path $logDir 'hindsight-follow-dsh.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$embed = 'C:\Users\x1787\.local\bin\hindsight-embed.exe'
$profileName = 'coding-agent'
$port = 9077

function Write-Log([string]$msg) {
  $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
  Add-Content -Path $log -Value $line -Encoding UTF8
}

function Test-DshRunning {
  # 只看带主窗口的那一个(排除 --type=gpu-process 等子进程)
  $p = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
       Where-Object { $_.MainWindowHandle -ne 0 }
  return [bool]$p
}

function Get-HindsightRoots {
  # 以 hindsight-api.exe 为树根(它的子进程 python 才是真正吃内存的)
  Get-CimInstance Win32_Process -Filter "Name='hindsight-api.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match "port\s+$port" }
}

function Test-HindsightListening {
  # ⚠ 不能用 Get-NetTCPConnection -State Listen 判断:2026-10-25 实测在这台机器上
  #   Listener 正常(HTTP 200)时该命令仍可能返回空/State 为空,导致监督进程误判"已停止"
  #   并反复重启。改直接 HTTP 探测 /docs(守护的真实健康端点)。
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/docs" -f $port) -TimeoutSec 6 -UseBasicParsing
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Stop-Hindsight {
  $roots = @(Get-HindsightRoots)
  if (-not $roots.Count) {
    # 退一步:按命令行找 uvx/uv(树根可能已换形态)
    $roots = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^(uvx|uv)\.exe$' -and $_.CommandLine -match "hindsight-api@.*$port" })
  }
  if (-not $roots.Count) { return $false }
  foreach ($r in $roots) {
    Write-Log ("stop: taskkill /T /F on pid=" + $r.ProcessId + " (" + $r.Name + ")")
    & taskkill /PID $r.ProcessId /T /F 2>&1 | Out-Null
  }
  Start-Sleep -Seconds 3
  return -not (Test-HindsightListening)
}

function Start-Hindsight {
  Write-Log 'start: hindsight-embed daemon start'
  & $embed -p $profileName daemon start 2>&1 | Out-Null
  # 守护冷启动约 20-30 秒(加载 embedding 模型),轮询等端口
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 3
    if (Test-HindsightListening) { Write-Log ('start: listening after ' + (($i+1)*3) + 's'); return $true }
  }
  Write-Log 'start: TIMEOUT (still not listening)'
  return $false
}

Write-Log '=== supervisor started ==='

do {
  $dsh = Test-DshRunning
  $alive = Test-HindsightListening

  if ($dsh -and -not $alive) {
    Write-Log 'DSH running, hindsight down -> starting'
    Start-Hindsight | Out-Null
  }
  elseif (-not $dsh -and $alive) {
    Write-Log 'DSH gone, hindsight still running -> stopping'
    Stop-Hindsight | Out-Null
  }
  elseif (-not $dsh -and -not $alive) {
    Write-Log 'DSH gone and hindsight down -> supervisor exits'
    break
  }

  if ($Once) { break }
  Start-Sleep -Seconds $PollSeconds
} while ($true)

Write-Log '=== supervisor exited ==='
