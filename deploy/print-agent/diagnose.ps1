<#
  银嘉 MES · 打印代理「现场诊断」(2026-11-16)

  用途:客户那边**打印机从面板上消失了/不出纸**,让客户双击「诊断.bat」,
        把生成的「诊断.txt」发回来 —— 一眼能分清是「代理没在跑」「代理在跑但没连服务器」
        还是「服务器上根本没收到这台电脑的心跳」。
        不需要懂命令行,不改任何东西(只读:不启动、不结束、不写配置)。

  也可能单独跑(白窗口里能看到同样内容):
    powershell -NoProfile -ExecutionPolicy Bypass -File diagnose.ps1

  设计要点:
    · 全部只读 —— 唯一的"写"是生成 诊断.txt 本身;
    · 不往服务器写心跳:查站点清单用 GET /api/px/print/station(不带 station 参数),
      否则一查就会把"这台电脑在线"写上去,反而误判;
    · 密码打码:自启项/配置/命令行里的 -Pass 一律显示 ***;
    · Win7(PowerShell 2.0)也能跑:同目录有 compat-ps2.ps1 就加载。
#>
[CmdletBinding()]
param(
    # 输出文件;默认同目录「诊断.txt」
    [string]$OutFile = ''
)

$ErrorActionPreference = 'Continue'

$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$outPath = if ($OutFile) { $OutFile } else { Join-Path $here '诊断.txt' }

# ── 输出:控制台 + 文件(两路都要,客户看窗口,我们看文件) ─────────────
$script:Lines = New-Object System.Collections.ArrayList
function Out2 {
    param([string]$Text = '')
    [void]$script:Lines.Add($Text)
    try { Write-Host $Text } catch { try { [Console]::Out.WriteLine($Text) } catch { } }
}
function Head {
    param([string]$Text)
    Out2 ''
    Out2 ('── ' + $Text + ' ' + ('-' * [Math]::Max(0, 56 - $Text.Length)))
}
function Mask-Pass {
    param([string]$s)
    if (-not $s) { return '' }
    $t = [regex]::Replace($s, '(-Pass\s+)(?:"[^"]*"|\S+)', '${1}"***"')
    $t = [regex]::Replace($t, '("pass"\s*:\s*)"[^"]*"', '${1}"***"')
    return $t
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

if ($PSVersionTable.PSVersion.Major -lt 3) {
    $compat = Join-Path $here 'compat-ps2.ps1'
    if (Test-Path $compat) { . $compat }
}

# ── 读参数:先 print-agent.config.json,没有再从自启项命令行里解析 ──────
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
$cfgState = '没有(自启项里应该带着全部参数)'
if (Test-Path $cfgPath) {
    $cfgState = '有'
    try {
        $cfg = ConvertFrom-Json ([System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8))
        if ($cfg.port) { $port = [int]$cfg.port }
        if ($cfg.server) { $server = [string]$cfg.server }
        if ($cfg.station) { $station = [string]$cfg.station }
        if ($cfg.user) { $user = [string]$cfg.user }
        if ($cfg.pass) { $pass = [string]$cfg.pass }
    } catch { $cfgState = '有,但读取失败:' + $_.Exception.Message }
}
if (-not $server -and $runVal) { $m = [regex]::Match($runVal, '-Server\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $server = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
if (-not $station -and $runVal) { $m = [regex]::Match($runVal, '-Station\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $station = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
if (-not $user -and $runVal) { $m = [regex]::Match($runVal, '-User\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $user = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }
if (-not $pass -and $runVal) { $m = [regex]::Match($runVal, '-Pass\s+(?:"([^"]*)"|(\S+))'); if ($m.Success) { $pass = $(if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }) } }

$healthUrl = "http://127.0.0.1:$port/health"

Out2 '================================================================'
Out2 ' 银嘉 MES · 打印代理 现场诊断(请把本文件整段发回来)'
Out2 '================================================================'
Out2 ('时间     : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Out2 ('计算机   : ' + $env:COMPUTERNAME)
Out2 ('登录用户 : ' + $env:USERDOMAIN + '\' + $env:USERNAME)
Out2 ('系统     : ' + [System.Environment]::OSVersion.VersionString)
Out2 ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
Out2 ('脚本目录 : ' + $here)

# ── 1 文件齐不齐 ─────────────────────────────────────────────────
Head '1 文件(缺哪个就是哪个的问题)'
foreach ($f in @('print-agent.ps1', 'watchdog.ps1', 'watchdog-hidden.vbs', 'compat-ps2.ps1', '安装.ps1')) {
    $p = Join-Path $here $f
    if (Test-Path $p) {
        $it = Get-Item $p
        Out2 ('  [有] ' + $f + '   ' + $it.Length + ' 字节   改于 ' + $it.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
    } else {
        Out2 ('  [缺] ' + $f + '   ← 请把整个 print-agent 文件夹重新拷过来')
    }
}
Out2 ('  配置文件 print-agent.config.json : ' + $cfgState)

# ── 2 开机自启 / 3 守护任务 ──────────────────────────────────────
Head '2 开机自启(HKCU Run)'
if ($runVal) { Out2 ('  ' + (Mask-Pass $runVal)) } else { Out2 '  [没有] 这台电脑没有装自启项(代理不会随登录启动)' }

Head '3 守护任务(每 1 分钟自检)'
try {
    $q = (& cmd.exe /c 'schtasks /query /tn "YinjiaMesPrintAgent-Watch" /fo list /v' 2>&1 | Out-String)
    if ($q -match 'YinjiaMesPrintAgent-Watch') {
        foreach ($ln in ($q -split "`r?`n")) {
            if ($ln -match '任务名|TaskName|状态|Status|上次运行|Last Run|上次结果|Last Result|要运行的任务|Task To Run|登录模式|Logon Mode') { Out2 ('  ' + $ln.Trim()) }
        }
    } else { Out2 '  [没有] 守护任务不存在 —— 代理掉了不会自动起来(重跑一次「安装.bat」)' }
} catch { Out2 ('  查询失败:' + $_.Exception.Message) }

# ── 4 进程 ───────────────────────────────────────────────────────
Head '4 进程(代理 / 守护)'
$procs = @()
try {
    $procs = @(Get-WmiObject Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and ($_.CommandLine -match 'print-agent\.ps1' -or $_.CommandLine -match 'watchdog') })
} catch { Out2 ('  查进程失败:' + $_.Exception.Message) }
if ($procs.Count -eq 0) { Out2 '  [没有] 没找到跑着 print-agent.ps1 的 PowerShell 进程 ← 代理没在跑' }
foreach ($p in $procs) {
    $st = ''
    try { $st = [System.Management.ManagementDateTimeConverter]::ToDateTime($p.CreationDate).ToString('yyyy-MM-dd HH:mm:ss') } catch { $st = [string]$p.CreationDate }
    Out2 ('  PID ' + $p.ProcessId + '  起于 ' + $st)
    Out2 ('      ' + (Mask-Pass ([string]$p.CommandLine)))
}

# ── 5 本机代理健康 ───────────────────────────────────────────────
Head ('5 本机代理 /health(端口 ' + $port + ')')
$health = $null
try {
    $r = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing
    $txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    Out2 ('  通:' + $txt)
    $health = ConvertFrom-Json $txt
} catch { Out2 ('  不通:' + $_.Exception.Message) }

# ── 6 轮询心跳 ───────────────────────────────────────────────────
Head '6 轮询心跳(代理有没有在向服务器取任务)'
$hb = Join-Path $here 'poll-heartbeat.txt'
if (Test-Path $hb) {
    $age = [int]((Get-Date) - (Get-Item $hb).LastWriteTime).TotalSeconds
    Out2 ('  poll-heartbeat.txt 最后更新:' + $age + ' 秒前(内容 ' + (Get-Content $hb -ErrorAction SilentlyContinue) + ')')
    if ($age -gt 180) { Out2 '  ↑ 超过 3 分钟没更新 = 轮询作业已经停了(代理看着活着,其实不领任务)' }
} else {
    Out2 '  没有 poll-heartbeat.txt:要么代理从没带服务器地址跑起来过,要么还是旧版代理'
}

# ── 7 服务器 ─────────────────────────────────────────────────────
Head ('7 服务器(' + $(if ($server) { $server } else { '没有配置地址' }) + ')')
if ($server) {
    $uri = $null
    try {
        $uri = New-Object System.Uri($server)
        $tc = New-Object System.Net.Sockets.TcpClient
        $iar = $tc.BeginConnect($uri.Host, $uri.Port, $null, $null)
        $okc = $iar.AsyncWaitHandle.WaitOne(5000, $false)
        if ($okc -and $tc.Connected) { Out2 ('  端口连通:' + $uri.Host + ':' + $uri.Port + ' 通') } else { Out2 ('  端口连通:' + $uri.Host + ':' + $uri.Port + ' 不通(网络/防火墙/服务器地址变了)') }
        $tc.Close()
    } catch { Out2 ('  端口检测失败:' + $_.Exception.Message) }

    $token = ''
    try {
        $body = @{ userName = $user; password = $pass; factory = 'YJ' }
        try {
            $cfgF = ConvertFrom-Json ([System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8))
            if ($cfgF.factory) { $body.factory = [string]$cfgF.factory }
        } catch { }
        $json = $body | ConvertTo-Json -Compress
        $r = Invoke-WebRequest -Uri ($server.TrimEnd('/') + '/api/auth/login') -Method Post `
             -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -ContentType 'application/json; charset=utf-8' `
             -UseBasicParsing -TimeoutSec 20
        $o = ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()))
        $token = $o.data.token
        if ($token) { Out2 ('  登录:' + $user + ' 登录成功') } else { Out2 ('  登录:返回里没有 token:' + $o.message) }
    } catch { Out2 ('  登录失败:' + $_.Exception.Message + '(账号密码改了 / 账套不对 / 地址不对)') }

    if ($token) {
        try {
            $h = Invoke-WebRequest -Uri ($server.TrimEnd('/') + '/api/px/print/station') -Headers @{ Authorization = ('Bearer ' + $token) } -TimeoutSec 20 -UseBasicParsing
            $st = ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($h.RawContentStream.ToArray()))
            Out2 '  服务器上的打印电脑清单(online=90 秒内有心跳):'
            $mineFound = $false
            foreach ($s in $st.data.stations) {
                $flag = $(if ($s.online) { '在线' } else { '离线' })
                $mark = ''
                if ($station -and $s.name -eq $station) { $mark = '   ← 这台电脑'; $mineFound = $true }
                Out2 ('    ' + $s.name + '  ' + $flag + '  开关=' + $s.enabled + '  类型=' + ($s.types -join ',') + '  最近心跳=' + $s.lastSeen + $mark)
            }
            if ($station) {
                if ($mineFound) { Out2 ('  ⇒ 服务器认得这台电脑(站点名 ' + $station + ')') }
                else { Out2 ('  ⇒ 服务器上没有站点名「' + $station + '」:名字对不上,或这台代理从没连上来过') }
            }
        } catch { Out2 ('  查站点清单失败:' + $_.Exception.Message) }
    }
} else {
    Out2 '  [跳过] 没有服务器地址 —— 代理不会自己拉任务(面板上永远离线),请重跑「安装.bat」'
}

# ── 8 打印机 ─────────────────────────────────────────────────────
Head '8 本机打印机'
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    $names = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters)
    if ($names.Count -eq 0) { Out2 '  [没有] 一台打印机都没装(任务会存成 PDF)' }
    foreach ($n in $names) { Out2 ('  - ' + $n) }
} catch { Out2 ('  列打印机失败:' + $_.Exception.Message) }

# ── 9 日志 ───────────────────────────────────────────────────────
Head '9 agent.log 最后 30 行'
$al = Join-Path $here 'agent.log'
if (Test-Path $al) { Get-Content $al -Tail 30 | ForEach-Object { Out2 ('  ' + $_) } } else { Out2 '  (没有 agent.log)' }
Head '10 watchdog.log 最后 20 行'
$wl = Join-Path $here 'watchdog.log'
if (Test-Path $wl) { Get-Content $wl -Tail 20 | ForEach-Object { Out2 ('  ' + $_) } } else { Out2 '  (没有 watchdog.log:守护任务还没跑过,或没注册)' }

# ── 11 结论(自动判定,给非技术的人也能看懂) ────────────────────
Head '11 结论'
if (-not $health) {
    if ($procs.Count -eq 0) { Out2 '  ✗ 代理**没在运行**:双击「安装.bat」重装一次即可(1 分钟装完);日志见第 9 段。' }
    else { Out2 '  ✗ 有代理进程但端口不通:多半是卡住/启动失败,双击「卸载.bat」再「安装.bat」;日志见第 9 段。' }
} else {
    $pollField = $null
    try { if ($health.PSObject.Properties.Name -contains 'poll') { $pollField = [bool]$health.poll } } catch { }
    if ($pollField -eq $false) { Out2 '  ✗ 进程活着,但**轮询已经停了**(不会领任务 = 面板离线):守护任务应会在 1 分钟内自动重启;若没重启,手动双击「安装.bat」。' }
    elseif ($pollField -eq $null) { Out2 '  ! 这是旧版代理(没有 poll 字段):建议把新文件夹拷过来、重跑「安装.bat」升级。' }
    elseif ($station) { Out2 ('  ✓ 本机代理在跑、在拉任务;若面板仍显示离线,那是站点名不一致(见第 7 段:服务器上叫「' + $station + '」吗)。') }
    else { Out2 '  ✓ 本机代理在跑;但没配服务器地址,不会自动领任务。' }
}

# ── 落盘 ─────────────────────────────────────────────────────────
try {
    [System.IO.File]::WriteAllLines($outPath, [string[]]$script:Lines, (New-Object System.Text.UTF8Encoding($true)))
    Out2 ''
    Out2 ('已保存到:' + $outPath + '(把这个文件发回来即可)')
} catch {
    Out2 ('!! 写文件失败:' + $_.Exception.Message)
}
