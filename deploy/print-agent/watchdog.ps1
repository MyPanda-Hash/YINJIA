<#
  银嘉 MES · 打印代理守护(watchdog,2026-11-16)

  为什么需要它(用户口径 2026-11-16:「打印代理的脚本是会掉的吗?客户那边的打印机已经不显示了」):
    代理本体是一个常驻 powershell 进程,原来唯一的启动点只有 HKCU\...\Run ——
    **登录时起一次,掉了就没人管**。现场会掉的四种情况(见《说明.md》§十一):
      ① 注销/切换用户/重启后没人登录(Run 只在该用户登录时跑);
      ② 进程被结束(任务管理器、杀毒、内存压力、端口被占时新实例 exit 1);
      ③ 监听线程抛异常 → 整个脚本收尾退出(旧版就是直接退出);
      ④ 轮询作业(Start-Job)自己死了,但 /health 还活着 —— 最隐蔽:
         面板上显示"离线",本机看"代理在跑",谁都不报警。
    本脚本由「每 1 分钟一次」的计划任务拉起(YinjiaMesPrintAgent-Watch),只做一件事:
      **保证这台电脑上有一个能领任务的代理在跑** —— 不在就拉起来,活着但不领任务就重启。

  判定顺序(命中就动作;全程只写 watchdog.log,不弹窗、不打扰人):
    1. http://127.0.0.1:<端口>/health 不通 → 没进程就起;有进程就再等一轮(可能正在启动/出纸);
    2. 通了,但 /health 里 poll=false(轮询没在跑)   → 重启;
    3. 通了且 /health 没有 poll 字段(旧版代理)     → 看 poll-heartbeat.txt 是否超 3 分钟没更新;
    4. 配置里没有服务器地址                        → 不做 2/3 判断(本来就不该领任务),只记一行;
    5. 一小时内已经动作过 5 次还不好                  → 停手并记一行「请人工处理」(避免反复重启刷屏)。

  手动用法:
    powershell -ExecutionPolicy Bypass -File watchdog.ps1            # 查一次(计划任务就是这么调的)
    powershell -ExecutionPolicy Bypass -File watchdog.ps1 -Status    # 只看状态,不动手
    powershell -ExecutionPolicy Bypass -File watchdog.ps1 -Force     # 强制重启一次(排障用)
#>
[CmdletBinding()]
param(
    # 无条件重启一次(排障用:不信健康检查结果时)
    [switch]$Force,
    # 只报告状态,不做任何启动/结束动作
    [switch]$Status,
    # 由人手动触发(「补启动.bat」/ start-agent.ps1):不受"一小时最多动作 5 次"限制
    [switch]$Manual
)

$ErrorActionPreference = 'Stop'

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$script:LogFile = Join-Path $here 'watchdog.log'
$script:ActFile = Join-Path $here 'watchdog-actions.txt'

function Log {
    param([string]$Text = '', [string]$Color = '')
    $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $Text
    if (-not $Status) {
        try {
            if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
        } catch { try { [Console]::Out.WriteLine($Text) } catch { } }
    }
    try { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }
}

# Win7 默认没有 TLS1.2(.NET 4.5+ 才认识);失败不致命
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

# ── 依赖文件 ──────────────────────────────────────────────────────
$agentPath = Join-Path $here 'print-agent.ps1'
if (-not (Test-Path $agentPath)) {
    Log "[FAIL] 同目录缺少 print-agent.ps1,守护无法工作: $agentPath" 'Red'
    exit 1
}

# PS2(Win7 自带)没有 ConvertFrom-Json / Invoke-WebRequest ⇒ 复用安装脚本那套兼容层
if ($PSVersionTable.PSVersion.Major -lt 3) {
    $compatFile = Join-Path $here 'compat-ps2.ps1'
    if (Test-Path $compatFile) { . $compatFile }
}

# ── 参数来源:① print-agent.config.json(2026-11-10 之后的安装) ────────
#             ② 没有 JSON 就从自启项那串命令行里解析(老安装的参数都在那里)
#    启动代理时也照抄自启项的命令行 —— 老机器被守护重起后**参数一个不丢**
#    (2026-11-10 之前装的机器没有 JSON,只用 -File 起会丢掉 -Server ⇒ 永远不领任务)。
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'
$runVal = ''
try { $runVal = [string](Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue).$RunName } catch { }

$port = 18777
$server = ''
$station = ''
$cfgPath = Join-Path $here 'print-agent.config.json'
if (Test-Path $cfgPath) {
    try {
        $cfg = ConvertFrom-Json ([System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8))
        if ($cfg.port) { $port = [int]$cfg.port }
        if ($cfg.server) { $server = [string]$cfg.server }
        if ($cfg.station) { $station = [string]$cfg.station }
    } catch {
        Log ("[WARN] 配置读取失败,按默认端口 18777 判断:" + $_.Exception.Message) 'Yellow'
    }
}
if ($runVal) {
    if (-not $server) { $m = [regex]::Match($runVal, '-Server\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $server = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
    if (-not $station) { $m = [regex]::Match($runVal, '-Station\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $station = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
}

# 启动命令:优先照抄自启项里的整串(exe + 参数),没有就用 -File + 配置文件
$agentExe = 'powershell.exe'
$agentArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agentPath + '"'
if ($runVal) {
    $m = [regex]::Match($runVal, '^\s*(?:"([^"]+)"|(\S+))\s+(.+)$')
    if ($m.Success) {
        $agentExe = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value })
        $agentArgs = $m.Groups[3].Value
    }
}

$healthUrl = "http://127.0.0.1:$port/health"
$hbFile = Join-Path $here 'poll-heartbeat.txt'

# ── 工具 ─────────────────────────────────────────────────────────
function Get-AgentProcs {
    # 按命令行匹配(不按端口:HttpListener 走 http.sys,端口那行的 PID 是 System,见卸载.ps1 注释)
    try {
        return @(Get-WmiObject Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match 'print-agent\.ps1' -and $_.ProcessId -ne $PID })
    } catch { return @() }
}

function Get-Health {
    # 返回 health 对象;不通返回 $null
    try {
        $r = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
        if ($r.StatusCode -ne 200) { return $null }
        return (ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())))
    } catch { return $null }
}

function Stop-Agents {
    foreach ($p in (Get-AgentProcs)) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Log "[守护] 已结束旧代理进程 PID $($p.ProcessId)" 'Yellow'
        } catch {
            Log "[守护] 结束 PID $($p.ProcessId) 失败:$($_.Exception.Message)" 'Yellow'
        }
    }
}

function Start-Agent {
    try {
        Start-Process -FilePath $agentExe -ArgumentList $agentArgs | Out-Null
    } catch {
        Log "[FAIL] 启动代理失败:$($_.Exception.Message)" 'Red'
        return $false
    }
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if (Get-Health) { return $true }
    }
    return $false
}

# 一小时内最多动作 5 次:代理被反复打不起来(比如 PS2 没有 Start-Job)时,
# 不要每分钟重启一次把机器拖住,而是停手留一行给人看。
function Can-Act {
    # ⚠ 本函数里任何异常都不能把守护打死(否则"守护自己挂了,代理也没人拉"),
    #   所以整体 try/catch,出错就放行(fail-open):宁可多重启一次,也不要什么都不做。
    # 人工点击(-Manual)不受限:人就在机器前面,不用替它省着。
    if ($Manual) { return $true }
    try {
        $win = (Get-Date).AddHours(-1)
        $recent = @()
        if (Test-Path $script:ActFile) {
            foreach ($ln in (Get-Content $script:ActFile -ErrorAction SilentlyContinue)) {
                $t = [datetime]::MinValue
                if ([datetime]::TryParse([string]$ln, [ref]$t)) { if ($t -gt $win) { $recent += $t } }
            }
        }
        if ($recent.Count -ge 5) { return $false }
        try { Add-Content -LiteralPath $script:ActFile -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -Encoding UTF8 } catch { }
        return $true
    } catch {
        Log ("[WARN] 动作计数失败(按可动作处理):" + $_.Exception.Message) 'Yellow'
        return $true
    }
}

function Do-Restart {
    param([string]$Why)
    if (-not (Can-Act)) {
        Log ('[守护] ' + $Why + ';但一小时内已自动重启 5 次仍不正常 ⇒ 本轮不再动作,请人工处理(把 agent.log / watchdog.log / 诊断.txt 发回来)') 'Red'
        exit 1
    }
    Log ('[守护] ' + $Why + ' ⇒ 重启代理') 'Yellow'
    Stop-Agents
    if (Start-Agent) { Log '[守护] 代理已重启' 'Green'; exit 0 }
    Log '[FAIL] 重启后 15 秒内 /health 仍不通 —— 看同目录 agent.log 最后几行' 'Red'
    exit 1
}

# ── 只报告 ───────────────────────────────────────────────────────
$h = Get-Health
$procs = @(Get-AgentProcs)

if ($Status) {
    Write-Host ("端口       : " + $port)
    Write-Host ("服务器     : " + $(if ($server) { $server } else { '(未配置:不会自动领任务)' }))
    Write-Host ("站点名     : " + $(if ($station) { $station } else { '(未配置)' }))
    if ($h) {
        $pf = ''
        try { if ($h.PSObject.Properties.Name -contains 'poll') { $pf = ' poll=' + $h.poll } } catch { }
        Write-Host ("/health    : 通 · " + $h.printer + $pf)
    } else { Write-Host '/health    : 不通' }
    Write-Host ("进程       : " + $(if ($procs.Count) { ($procs | ForEach-Object { $_.ProcessId }) -join ',' } else { '无' }))
    if (Test-Path $hbFile) {
        $age = [int]((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalSeconds
        Write-Host ("轮询心跳   : " + $age + " 秒前")
    } else { Write-Host '轮询心跳   : (没有心跳文件 —— 说明轮询作业从没跑起来过,或还是旧版代理)' }
    Write-Host ("启动命令   : " + $agentExe + ' ' + $agentArgs)
    $mk = Join-Path $here 'watchdog-last.txt'
    if (Test-Path $mk) { Write-Host ("上次自检   : " + (Get-Item $mk).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) }
    exit 0
}

if ($Force) { Do-Restart '-Force 强制重启' }

# ⚠ 下面整段包在 try/catch 里:守护脚本自己出错也必须留一行日志,
#   不能像 2026-11-16 第一次实测那样"静默退出、什么都不做"(那次是 TryParse 重载报错)。
try {

# ── ① 完全不响应 ─────────────────────────────────────────────────
if (-not $h) {
    if ($procs.Count -gt 0) {
        # 有进程但还没通:可能在启动/打印中,给一轮机会(不重复起,免得端口冲突刷日志)
        Log ("[守护] $healthUrl 不通,但已有代理进程 PID " + (($procs | ForEach-Object { $_.ProcessId }) -join ',') + ":本轮不新建,下一分钟再看") 'Yellow'
        exit 0
    }
    Do-Restart '代理没在运行'
}

# ── ② 活着,但没在领任务(最隐蔽的一种"掉") ──────────────────────
if ($server) {
    $pollFlag = $null
    try { if ($h.PSObject.Properties.Name -contains 'poll') { $pollFlag = [bool]$h.poll } } catch { }
    if ($pollFlag -eq $false) { Do-Restart '/health 正常但轮询已停(poll=false)' }
    if ($null -eq $pollFlag) {
        # 旧版代理没上报 poll:退化为看心跳文件新鲜度(轮询每 4 秒写一次)
        if (Test-Path $hbFile) {
            $age = ((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalMinutes
            if ($age -gt 3) { Do-Restart ('轮询心跳已停 ' + [int]$age + ' 分钟(poll-heartbeat.txt)') }
        } else {
            # 没有心跳文件:可能刚装(还没跑够一轮),也可能轮询作业压根没起来
            $started = $null
            try { $started = (Get-Process -Id $procs[0].ProcessId).StartTime } catch { }
            if ($started -and ((Get-Date) - $started).TotalMinutes -gt 10) {
                Do-Restart '代理跑了 10 分钟却从没出现过轮询心跳(轮询作业没起来?)'
            }
        }
    }
}

# ── ③ 一切正常:每小时记一行(不把日志刷爆),并刷新 watchdog-last.txt ──
$markFile = Join-Path $here 'watchdog-last.txt'
$hbAge = -1
if (Test-Path $hbFile) { $hbAge = [int]((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalSeconds }
$logOk = $true
if (Test-Path $markFile) {
    if (((Get-Date) - (Get-Item $markFile).LastWriteTime).TotalMinutes -lt 60) { $logOk = $false }
}
try { [System.IO.File]::WriteAllText($markFile, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) } catch { }
if ($logOk) {
    $detail = $(if ($server) {
        if ($hbAge -ge 0) { ',轮询心跳 ' + $hbAge + ' 秒前' } else { ',尚未出现轮询心跳' }
    } else { ',未配服务器地址(只等页面推任务)' })
    Log ('[守护] 一切正常(代理在跑' + $detail + ')') 'DarkGray'
}
exit 0

} catch {
    Log ("[FAIL] 守护脚本自身出错:" + $_.Exception.Message) 'Red'
    exit 1
}
