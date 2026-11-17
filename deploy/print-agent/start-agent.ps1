<#
  银嘉 MES · 打印代理「补启动」(手动一键修复 + 启动,2026-11-16)

  用户口径(2026-11-16):「再添加一个可以手动点补启动的程序」——
  现场不想每次都跑「安装.bat」(它要重新填服务器地址/账号,填错反而更糟),
  只需要一个**双击就能把代理拉起来**的东西。本脚本就是它,做四件事:

    ① 看现状:进程在不在 / `/health` 通不通 / 有没有在领任务(poll)/ 心跳多久前 /
       自启项在不在 / 守护任务在不在;
    ② **补齐启动项**:自启项(HKCU Run)或守护任务(每 1 分钟)被人/杀毒删掉了,
       就用现有配置原样写回去(参数取 print-agent.config.json,老机器取现有自启项);
    ③ **启动/重启代理**:没跑就起;已经在跑就只报状态(除非双击时按 R,或带 -Restart);
    ④ 复核:再查一遍 `/health`、轮询心跳,并去服务器看这台站点显示"在线"没有。

  ⚠ 只用现成配置:如果这台电脑从来没装过(既没有配置文件也没有自启项),
    那本脚本修不了 —— 会提示去双击「安装.bat」。

  用法(客户那边就是双击「补启动.bat」):
    powershell -NoProfile -ExecutionPolicy Bypass -File start-agent.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File start-agent.ps1 -Restart   # 强制重启一次
#>
[CmdletBinding()]
param(
    # 代理已经在跑,也强制重启一次(换了打印机驱动/改了配置之后用)
    [switch]$Restart
)

# 修复流程里某一步失败要能继续往下走,所以不要 Stop
$ErrorActionPreference = 'Continue'

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$agentPath = Join-Path $here 'print-agent.ps1'
$watchdogPath = Join-Path $here 'watchdog.ps1'
$logFile = Join-Path $here 'watchdog.log'

function Say {
    param([string]$Text = '', [string]$Color = '')
    try {
        if ($Color) { Write-Host $Text -ForegroundColor $Color } else { Write-Host $Text }
    } catch { try { [Console]::Out.WriteLine($Text) } catch { } }
    try { Add-Content -LiteralPath $logFile -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  [补启动] ' + $Text) -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

# PS2(Win7 自带)没有 ConvertFrom-Json / Invoke-WebRequest ⇒ 复用安装脚本那套兼容层
if ($PSVersionTable.PSVersion.Major -lt 3) {
    $compatFile = Join-Path $here 'compat-ps2.ps1'
    if (Test-Path $compatFile) { . $compatFile }
}

Say ''
Say '=== 银嘉 MES · 打印代理 补启动 ===' 'Cyan'
Say ''

if (-not (Test-Path $agentPath)) {
    Say "[FAIL] 同目录缺少 print-agent.ps1,没法补启动。" 'Red'
    Say '       请把整个 print-agent 文件夹重新拷过来(不要只拷一个文件)。' 'Red'
    exit 1
}

# ── 参数来源:配置文件优先,其次自启项里的那串命令行(老机器) ─────────
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'YinjiaMesPrintAgent'
$runVal = ''
try { $runVal = [string](Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue).$RunName } catch { }

$port = 18777
$server = ''
$station = ''
$user = ''
$pass = ''
$cfgPath = Join-Path $here 'print-agent.config.json'
$hasCfg = Test-Path $cfgPath
if ($hasCfg) {
    try {
        $cfg = ConvertFrom-Json ([System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8))
        if ($cfg.port) { $port = [int]$cfg.port }
        if ($cfg.server) { $server = [string]$cfg.server }
        if ($cfg.station) { $station = [string]$cfg.station }
        if ($cfg.user) { $user = [string]$cfg.user }
        if ($cfg.pass) { $pass = [string]$cfg.pass }
    } catch { Say ('[WARN] 配置文件读不出来:' + $_.Exception.Message) 'Yellow' }
}
if ($runVal) {
    if (-not $server) { $m = [regex]::Match($runVal, '-Server\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $server = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
    if (-not $station) { $m = [regex]::Match($runVal, '-Station\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $station = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
    if (-not $user) { $m = [regex]::Match($runVal, '-User\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $user = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
    if (-not $pass) { $m = [regex]::Match($runVal, '-Pass\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $pass = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
}

if (-not $hasCfg -and -not $runVal) {
    Say '[FAIL] 这台电脑还没装过打印代理(既没有配置文件,也没有自启项)。' 'Red'
    Say '       请双击「安装.bat」装一次(要填服务器地址与密码);装好以后才用它。' 'Red'
    exit 1
}

$healthUrl = "http://127.0.0.1:$port/health"
$hbFile = Join-Path $here 'poll-heartbeat.txt'
$taskName = 'YinjiaMesPrintAgent-Watch'

function Get-Agents {
    try {
        return @(Get-WmiObject Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match 'print-agent\.ps1' -and $_.ProcessId -ne $PID })
    } catch { return @() }
}
function Get-Health {
    try {
        $r = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
        if ($r.StatusCode -ne 200) { return $null }
        return (ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())))
    } catch { return $null }
}
function Test-Task {
    try {
        $q = (& cmd.exe /c ('schtasks /query /tn "' + $taskName + '" /fo list') 2>&1 | Out-String)
        return ($q -match [regex]::Escape($taskName))
    } catch { return $false }
}

# ── ① 现状 ───────────────────────────────────────────────────────
$procs = @(Get-Agents)
$health = Get-Health
Say '--- 现在的情况 ---' 'Cyan'
Say ('  服务器  : ' + $(if ($server) { $server } else { '(没有配置!)' }))
Say ('  站点名  : ' + $(if ($station) { $station } else { '(没有配置!)' }))
Say ('  配置文件: ' + $(if ($hasCfg) { '有' } else { '没有(用自启项里的参数)' }))
Say ('  自启项  : ' + $(if ($runVal) { '有' } else { '没有 ← 需要补' }))
Say ('  守护任务: ' + $(if (Test-Task) { '有(每 1 分钟自检)' } else { '没有 ← 需要补' }))
Say ('  进程    : ' + $(if ($procs.Count) { '在跑(PID ' + (($procs | ForEach-Object { $_.ProcessId }) -join ',') + ')' } else { '没在跑' }))
if ($health) {
    $pollTxt = ''
    try { if ($health.PSObject.Properties.Name -contains 'poll') { $pollTxt = '  领任务=' + $health.poll } } catch { }
    Say ('  /health : 通  打印机=' + $health.printer + $pollTxt) 'Green'
} else {
    Say '  /health : 不通(代理没在跑,或者卡住了)' 'Yellow'
}
if (Test-Path $hbFile) {
    Say ('  轮询心跳: ' + [int]((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalSeconds + ' 秒前')
}

# ── ② 补自启项(按现有配置原样写回) ──────────────────────────────
if (-not $runVal) {
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agentPath + '"'
    try {
        if (-not (Test-Path $RunKey)) { New-Item -Path $RunKey -Force | Out-Null }
        Set-ItemProperty -Path $RunKey -Name $RunName -Value $cmd
        Say '[补] 已写回开机自启项(下次登录会自动起)' 'Green'
        $runVal = $cmd
    } catch {
        Say ('[WARN] 写自启项失败:' + $_.Exception.Message + '(不影响本次启动)') 'Yellow'
    }
}

# ── ③ 补守护任务(每 1 分钟;没有它,代理再掉就没人管了) ──────────
if (-not (Test-Task)) {
    $vbs = Join-Path $here 'watchdog-hidden.vbs'
    if ((Test-Path $vbs) -and (Test-Path $watchdogPath)) {
        $trValue = 'wscript.exe \"' + $vbs + '\"'
        $cmdLine = 'schtasks /create /tn "' + $taskName + '" /tr "' + $trValue + '" /sc minute /mo 1 /ru "' + $env:USERNAME + '" /it /f'
        $o = (& cmd.exe /c $cmdLine 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) {
            Say '[补] 已补回守护任务(每 1 分钟自检一次)' 'Green'
            & cmd.exe /c ('schtasks /run /tn "' + $taskName + '"') 2>&1 | Out-Null
        } else {
            Say ('[WARN] 补守护任务失败:' + $o) 'Yellow'
        }
    } else {
        Say '[WARN] 同目录缺少 watchdog.ps1 / watchdog-hidden.vbs,跳过守护任务(整个文件夹一起拷)' 'Yellow'
    }
}

# ── ④ 启动 / 重启 ────────────────────────────────────────────────
$needRestart = $false
if (-not $health) {
    $needRestart = $true
    Say '[做] 代理没在运行,开始启动 ...' 'Yellow'
    if ($procs.Count -gt 0) {
        Say '     先收拾一下残留进程 ...' 'DarkGray'
    }
} else {
    Say ''
    Say '代理本来就在跑。' 'Green'
    if (-not $Restart) {
        $ans = ''
        try { $ans = (Read-Host '要强制重启它吗?(直接回车 = 不重启,输入 R 回车 = 重启一次)') } catch { $ans = '' }
        if ($ans -and $ans.Trim().ToUpper() -eq 'R') { $Restart = $true }
    }
    if ($Restart) {
        $needRestart = $true
        Say '[做] 按要求重启代理 ...' 'Yellow'
    }
}

if ($needRestart) {
    # 交给 watchdog 做"停旧 + 起新 + 等健康"(-Manual = 人工点击,不受"一小时最多 5 次"限制)
    if (Test-Path $watchdogPath) {
        $o = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $watchdogPath -Force -Manual 2>&1 | Out-String)
        foreach ($ln in ($o -split "`r?`n")) { if ($ln.Trim()) { Say ('  ' + $ln.Trim()) } }
    } else {
        # 没有 watchdog 就自己来
        foreach ($p in (Get-Agents)) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { } }
        Start-Sleep -Seconds 1
        $exe = 'powershell.exe'
        $args = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agentPath + '"'
        if ($runVal) {
            $m = [regex]::Match($runVal, '^\s*(?:"([^"]+)"|(\S+))\s+(.+)$')
            if ($m.Success) {
                $exe = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value })
                $args = $m.Groups[3].Value
            }
        }
        Start-Process -FilePath $exe -ArgumentList $args | Out-Null
        for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 500; if (Get-Health) { break } }
    }
}

# ── ⑤ 复核 ───────────────────────────────────────────────────────
Start-Sleep -Milliseconds 800
$health = Get-Health
$procs = @(Get-Agents)
Say ''
Say '--- 修完之后 ---' 'Cyan'
if ($health) {
    $pollTxt = ''
    $pollVal = $null
    try { if ($health.PSObject.Properties.Name -contains 'poll') { $pollVal = $health.poll; $pollTxt = '  领任务=' + $health.poll } } catch { }
    Say ('  /health : 通  打印机=' + $health.printer + $pollTxt) 'Green'
    if ($pollVal -eq $false) { Say '  ↑ 进程起来了但没在领任务:等 1 分钟让守护任务再重启一次,或看 agent.log' 'Yellow' }
} else {
    Say '  /health : 还是不通 —— 请双击「诊断.bat」,把 诊断.txt 发回来' 'Red'
}
Say ('  进程    : ' + $(if ($procs.Count) { '在跑(PID ' + (($procs | ForEach-Object { $_.ProcessId }) -join ',') + ')' } else { '没在跑' }))
if (Test-Path $hbFile) {
    Say ('  轮询心跳: ' + [int]((Get-Date) - (Get-Item $hbFile).LastWriteTime).TotalSeconds + ' 秒前')
}

# 去服务器上看这台电脑显示"在线"没有(最实在的验收)
if ($server -and $user -and $pass) {
    try {
        $body = @{ userName = $user; password = $pass; factory = 'YJ' }
        if ($hasCfg) {
            try { $cf = ConvertFrom-Json ([System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8)); if ($cf.factory) { $body.factory = [string]$cf.factory } } catch { }
        }
        $r = Invoke-WebRequest -Uri ($server.TrimEnd('/') + '/api/auth/login') -Method Post `
            -Body ([System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))) `
            -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec 20
        $tok = (ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()))).data.token
        if ($tok) {
            $st = Invoke-WebRequest -Uri ($server.TrimEnd('/') + '/api/px/print/station') `
                -Headers @{ Authorization = ('Bearer ' + $tok) } -UseBasicParsing -TimeoutSec 20
            $list = (ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($st.RawContentStream.ToArray()))).data.stations
            $mine = $null
            foreach ($s in $list) { if ($s.name -eq $station) { $mine = $s } }
            if ($mine) {
                $flag = $(if ($mine.online) { '在线' } else { '离线' })
                $col = $(if ($mine.online) { 'Green' } else { 'Yellow' })
                Say ('  服务器上: 「' + $station + '」' + $flag + '  开关=' + $mine.enabled + '  最近心跳=' + $mine.lastSeen) $col
                if ($mine.online -and -not $mine.enabled) { Say '          注意:这台电脑的"自动打印开关"是关的 ⇒ 面板在线也不会领单,去「自动打印」页打开' 'Yellow' }
            } else {
                Say ('  服务器上: 没有站点名「' + $station + '」 ⇒ 站点名对不上(或从没连上过),看「诊断.bat」第 7 段') 'Yellow'
            }
        }
    } catch {
        Say ('  (查服务器站点状态失败:' + $_.Exception.Message + ' —— 只影响这段提示,不影响打印)') 'DarkGray'
    }
}

Say ''
Say '完成。若还是不出纸:双击「诊断.bat」,把 诊断.txt 发回来。' 'Cyan'
Say ''
exit 0
