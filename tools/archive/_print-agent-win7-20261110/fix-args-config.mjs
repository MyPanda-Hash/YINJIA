// 2026-11-10 现场:打印机名带空格/中文,`Start-Process -ArgumentList @(...)` 会被拆开
// (EPSON LQ-635KII ESC/P2 (副本 1) → "EPSON"),代理起来后打印机不对/启动失败。
// 改为:自启与安装都只传 -File,参数全部读同目录 print-agent.config.json。
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'D:/YINJIA-main/deploy/print-agent/'

// ── ① 代理:读配置文件(参数优先) ─────────────────────────────────────────
{
  const p = dir + 'print-agent.ps1'
  let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const anchor = `$ScriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }`
  if (!t.includes(anchor)) throw new Error('agent: 找不到 ScriptPath 锚点')
  if (t.includes('print-agent.config.json')) {
    console.log('[skip] agent 已支持配置文件')
  } else {
    const block = anchor + `

# ── 配置:优先读同目录 print-agent.config.json(2026-11-10)──────────────────
# 现场打印机名是 "EPSON LQ-635KII ESC/P2 (副本 1)"(带空格/括号),站点是 "仓库" ——
# 用 Start-Process -ArgumentList @(...) 传参会按空格拆开(实测只剩 "EPSON"),所以自启与安装
# 都只传 -File,其余参数从这里的 JSON 读;命令行显式给了的仍然优先。
$script:CfgPath = Join-Path (Split-Path -Parent $ScriptPath) 'print-agent.config.json'
if (Test-Path $script:CfgPath) {
    try {
        $rawCfg = [System.IO.File]::ReadAllText($script:CfgPath, [System.Text.Encoding]::UTF8)
        $cfgObj = ConvertFrom-Json $rawCfg
        if (-not $PSBoundParameters.ContainsKey('Port') -and $cfgObj.port) { $Port = [int]$cfgObj.port }
        if (-not $PSBoundParameters.ContainsKey('Printer') -and $cfgObj.printer) { $Printer = [string]$cfgObj.printer }
        if (-not $PSBoundParameters.ContainsKey('Mode') -and $cfgObj.mode) { $Mode = [string]$cfgObj.mode }
        if (-not $PSBoundParameters.ContainsKey('Server') -and $cfgObj.server) { $Server = [string]$cfgObj.server }
        if (-not $PSBoundParameters.ContainsKey('User') -and $cfgObj.user) { $User = [string]$cfgObj.user }
        if (-not $PSBoundParameters.ContainsKey('Pass') -and $cfgObj.pass) { $Pass = [string]$cfgObj.pass }
        if (-not $PSBoundParameters.ContainsKey('Factory') -and $cfgObj.factory) { $Factory = [string]$cfgObj.factory }
        if (-not $PSBoundParameters.ContainsKey('Station') -and $cfgObj.station) { $Station = [string]$cfgObj.station }
        Say ("[配置] 已读取 " + $script:CfgPath) 'DarkGray'
    } catch {
        Say ("[WARN] 配置文件读取失败(继续用命令行参数):" + $_.Exception.Message) 'Yellow'
    }
}`
    t = t.replace(anchor, block)
    writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
    console.log('[patched] agent 支持读配置')
  }
}

// ── ② 安装:自启/启动只传 -File ──────────────────────────────────────────
{
  const p = dir + '安装.ps1'
  let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (t.includes("'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"")) {
    console.log('[skip] 安装脚本已改成只传 -File')
  } else {
    // 自启命令:引号包住脚本路径,不带任何参数(参数在 config 里)
    const oldCmd = `$cmd = 'powershell.exe ' + ($argParts -join ' ')`
    if (!t.includes(oldCmd)) throw new Error('安装: 找不到 $cmd 构造')
    t = t.replace(oldCmd, `# 只传 -File:参数全在 print-agent.config.json(避免打印机名/站点名带空格被拆开)
$cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agent + '"'`)

    // 启动:同样只传 -File;失败时把 agent.log 打出来
    const oldStart = `    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $agent, '-Port', "$Port", '-Mode', $Mode,
        '-Server', $Server, '-User', $User, '-Pass', $Pass, '-Factory', $Factory,
        '-Station', $Station, '-Printer', $Printer
    )`
    if (!t.includes(oldStart)) throw new Error('安装: 找不到 Start-Process 段')
    t = t.replace(oldStart, `    # 只传 -File(参数读 config):带空格/中文的参数用数组传会被拆开
    $agentLog = Join-Path $here 'agent.log'
    $proc = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $agent
    )`)

    // 超时提示:带上退出码 + agent.log 末尾
    const oldWarn = `    else { Say '[WARN] 代理启动后 12 秒内没响应,请手动跑一次 print-agent.ps1 看报错。' 'Yellow' }`
    if (!t.includes(oldWarn)) throw new Error('安装: 找不到超时提示段')
    t = t.replace(oldWarn, `    else {
        Say '[WARN] 代理启动后 20 秒内没响应,下面把它的日志打出来(agent.log 最后 15 行):' 'Yellow'
        try {
            if ($proc -and $proc.HasExited) { Say ("       进程已退出,退出码 " + $proc.ExitCode) 'Yellow' }
        } catch { }
        try {
            if (Test-Path $agentLog) { Get-Content $agentLog -Tail 15 | ForEach-Object { Say ("       " + $_) } }
            else { Say '       同目录还没有 agent.log —— 说明脚本连第一行都没跑起来(权限/杀毒拦截?)' 'Yellow' }
        } catch { }
    }`)
    t = t.replace('for ($i = 0; $i -lt 24; $i++) {', 'for ($i = 0; $i -lt 40; $i++) {')
    writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
    console.log('[patched] 安装只传 -File + 失败打日志')
  }
}
