'use strict'
/**
 * _probe-stock-reconcile.cjs — 端到端验证「结存(kucun) == Σ流水(inh 正 − outh 负)」启动对账自检真的在跑。
 * (2026-09-30 库存三表结构 · 任务 5 的验收探针)
 *
 * 为什么要故意改歪一行:**"日志里出现了一致"也可能只是自检压根没执行**(或执行了但恒真)。
 * 唯一能证明它不是摆设的办法,是把数据改歪再跑一次,看它是否真的喊出差异 —— 然后再还原、再证一致。
 *
 * 三步:
 *   ① 正常态:重启 8090 → 启动日志出现 `[库存对账] 结存 == Σ流水,一致(N 个三键)`
 *   ② 改歪一行:`UPDATE kucun SET yl = yl + 999 WHERE id = <靶行>` → 重启 → 日志出现
 *      `发现 1 个三键不一致` 并列出该三键(结存=原值+999 流水=原值)
 *   ③ 还原该行(精确到 IEEE 位)→ 重启 → 日志回到 `一致`;并核实库里的值 == 原值
 *
 * ⚠ 本探针改的是**正式账套 HSDZ_MES**(启动自检读的就是它,测试账套证明不了正式库的事),
 *   所以第 ② 步的改动必须精确还原:原值按 `CAST(yl AS decimal(38,10))` 取字面量,
 *   还原后除了比对十进制串,还比对 `CONVERT(binary(8), yl)` 的 IEEE 位串
 *   (实测两种取法对本库 31 行的往返都位级相等)。
 *   无论中途怎么失败,finally 里都会先还原再退出;结束时用 start-prod.ps1 把服务恢复成正常态(不落临时日志)。
 *
 * 为什么自己去起 java 而不用 start-prod.ps1:它是 `-WindowStyle Hidden` 且不重定向,
 * 应用日志(含本自检的 System.out/err 与 logback 控制台输出)只进那个隐藏窗口,外部拿不到。
 * 故这里用**同一套 JDK 25 探测 + 同一个 .env 注入 + 同一个 jar/工作目录**,只多一个 RedirectStandardOutput。
 *
 * 用法: node tools/archive/_probe-stock-reconcile.cjs
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const ROOT = path.resolve(__dirname, '..', '..')
const BACKEND = path.join(ROOT, 'backend')
const JAR = path.join(BACKEND, 'target', 'yinjia-mes-backend-0.1.0.jar')
const SRC = path.join(BACKEND, 'src', 'main', 'java', 'com', 'yinjia', 'mes', 'service', 'InvCostService.java')
const DB = 'HSDZ_MES'                    // 启动自检读正式账套 ⇒ 只能在这里做实验
const TMP = path.join(process.env.TEMP || os.tmpdir(), 'probe-stock-reconcile')
const PORT = 8090
/** 嵌进 PowerShell 的路径统一用正斜杠:反斜杠在 JS 模板串里会被当转义(\t \b 等)吃掉 */
const fw = (p) => p.replace(/\\/g, '/')

let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// -I:QUOTED_IDENTIFIER ON —— inh/outh 上有过滤索引,kucun 虽无,统一带上免踩 1934
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', DB, '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-I', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()
const num = (q) => Number(sql(q) || 0)

/** JDK 25 探测:与 start-prod.ps1 同一套(优先 JAVA_HOME,其次常见安装位置;按 release 的 JAVA_VERSION 版本门控) */
const JDK_PRELUDE = `
function Test-Jdk25([string]$jdkHome) {
  if (-not $jdkHome) { return $false }
  $java = Join-Path $jdkHome 'bin/java.exe'; $rel = Join-Path $jdkHome 'release'
  if (-not (Test-Path $java) -or -not (Test-Path $rel)) { return $false }
  $line = Select-String -Path $rel -Pattern '^JAVA_VERSION="([0-9]+)' | Select-Object -First 1
  if (-not $line) { return $false }
  return ([int]$line.Matches[0].Groups[1].Value -ge 25)
}
$jdkCands = @()
if ($env:JAVA_HOME) { $jdkCands += $env:JAVA_HOME.TrimEnd('\\') }
foreach ($d in @("$env:USERPROFILE/.jdks", 'C:/Program Files/Java', 'D:/Program Files/Java')) {
  if (Test-Path $d) { $jdkCands += (Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
}
$jdk25 = $jdkCands | Where-Object { Test-Jdk25 $_ } | Select-Object -First 1
$javaExe = if ($jdk25) { Join-Path $jdk25 'bin/java.exe' } else { 'java' }
`
const ps = (script) => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
  { encoding: 'utf8' }).trim()
/**
 * 起服务专用:必须把 stdio 全部忽略。
 * 踩过的坑 —— 默认(pipe)下 execFileSync 会一直等"管道关闭",而被 Start-Process 拉起的 java
 * 继承了这些管道句柄 ⇒ **powershell 早已退出、应用早已起来,node 却永远卡在这一行**
 * (实测 5 分钟无输出,但日志文件里那行早就有了)。stdio:'ignore' 后没有任何句柄可继承,调用立刻返回。
 */
const psDetached = (script) => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
  { stdio: 'ignore' })

const STOP_PS = `
$p = Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
for ($i = 0; $i -lt 40; $i++) {
  if (-not (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}
if (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue) { Write-Output 'STILL_LISTENING' } else { Write-Output 'STOPPED' }
`

const startPs = (tag) => `
$out = Join-Path '${fw(TMP)}' '${tag}.out.log'; $err = Join-Path '${fw(TMP)}' '${tag}.err.log'
${JDK_PRELUDE}
$envFile = Join-Path '${fw(BACKEND)}' '.env'
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim(); if (-not $t -or $t.StartsWith('#') -or $t -notmatch '=') { continue }
    $kv = $t -split '=', 2
    [Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim(), 'Process')
  }
}
Start-Process -FilePath $javaExe -WorkingDirectory '${fw(BACKEND)}' -WindowStyle Hidden \`
  -RedirectStandardOutput $out -RedirectStandardError $err \`
  -ArgumentList '-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-Dfile.encoding=UTF-8', \`
    '-jar','target/yinjia-mes-backend-0.1.0.jar','--spring.output.ansi.enabled=never'
Write-Output ("STARTED " + $javaExe)
`

/** 读日志;Java 默认按系统 ANSI 码页写,万一没吃到 -Dstdout.encoding=UTF-8 就按 GBK 兜底 */
function readText(p) {
  if (!fs.existsSync(p)) return ''
  const b = fs.readFileSync(p)
  let s = b.toString('utf8')
  if (s.includes('\uFFFD')) { try { s = new TextDecoder('gbk').decode(b) } catch { /* 保持 utf8 结果 */ } }
  return s.replace(/\u001b\[[0-9;]*m/g, '')
}
const logsOf = (tag) => readText(path.join(TMP, tag + '.out.log')) + '\n' + readText(path.join(TMP, tag + '.err.log'))
const linesWith = (txt, needle) => txt.split(/\r?\n/).filter((l) => l.includes(needle) && l.trim())

/** 重启 → 等 `[库存对账]` 那行出现 → 返回该行数组(调用方负责打印原文) */
async function restartAndCapture(tag, timeoutMs = 180000) {
  if (ps(STOP_PS).includes('STILL_LISTENING')) throw new Error(`${tag}: 8090 停不下来`)
  fs.mkdirSync(TMP, { recursive: true })
  psDetached(startPs(tag))
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const hit = linesWith(logsOf(tag), '库存对账')
    if (hit.length) return hit
    await sleep(1000)
  }
  const tail = logsOf(tag).trim().split(/\r?\n/).slice(-15).join('\n')
  throw new Error(`${tag}: 等 ${timeoutMs / 1000}s 未见「库存对账」日志。日志尾部:\n${tail}`)
}

async function main() {
  // ── 前置:jar 必须比源码新(防止"改了没编译"却以为验证过了) ──
  const jarT = fs.statSync(JAR).mtimeMs, srcT = fs.statSync(SRC).mtimeMs
  check('前置:jar 比 InvCostService.java 新(说明本探针验的是新码)',
    jarT >= srcT, `jar=${new Date(jarT).toLocaleString()} src=${new Date(srcT).toLocaleString()}`)
  if (jarT < srcT) throw new Error('请先 `mvn package`(8090 在跑会锁住 jar,先停服务)')

  // 每次跑都从空目录开始:否则上一轮留下的日志已含「一致」,第一步会"未卜先知"地立刻通过(假绿)
  fs.rmSync(TMP, { recursive: true, force: true })

  // ── 基线:靶行 + 全库结存指纹 ──
  const id = num(`SELECT TOP 1 id FROM kucun ORDER BY id;`)
  const key = sql(`SELECT wzdm, ckdm, ISNULL(lot_no,'(null)') FROM kucun WHERE id = ${id};`).split('\t').join('|')
  const origDec = sql(`SELECT CONVERT(varchar(60), CAST(yl AS decimal(38,10)), 2) FROM kucun WHERE id = ${id};`)
  const origHex = sql(`SELECT CONVERT(varchar(20), CONVERT(binary(8), yl), 2) FROM kucun WHERE id = ${id};`)
  const baseRows = num(`SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';`)
  const baseSum = num(`SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';`)
  console.log(`靶行: kucun.id=${id} 三键=${key} 原值 yl=${origDec}(位串 ${origHex})`)
  console.log(`基线: kucun ${baseRows} 行,合计 ${baseSum}`)
  console.log(`临时日志目录: ${TMP}\n`)

  let perturbed = false, restored = false
  const callRestore = () => {
    const r = sql(`UPDATE kucun SET yl = CAST('${origDec}' AS float) WHERE id = ${id}; SELECT CAST(@@ROWCOUNT AS varchar(10));`)
    perturbed = false
    restored = true
    return r
  }

  try {
    // ── ① 正常态:必须出现「一致」(自检真跑了,而且真算过) ──
    console.log('① 正常态重启(期望:一致) ...')
    const l1 = await restartAndCapture('1-normal')
    console.log('  ── 日志原文 ──\n' + l1.map((l) => '  ' + l.trim()).join('\n'))
    check('① 日志出现「一致」', l1.some((l) => l.includes('一致')))
    check(`① 一致的三键数 = kucun 行数 ${baseRows}`, l1.some((l) => l.includes(`一致(${baseRows} 个三键)`)), l1.join(' | '))

    // ── ② 故意改歪一行(先停服务再改,避免与在跑的连接/缓存互相干扰) ──
    console.log('\n② 改歪一行(yl + 999)后重启(期望:发现 1 个三键不一致) ...')
    ps(STOP_PS)
    sql(`UPDATE kucun SET yl = yl + 999 WHERE id = ${id};`)
    perturbed = true
    const distorted = sql(`SELECT CONVERT(varchar(60), CAST(yl AS decimal(38,10)), 2) FROM kucun WHERE id = ${id};`)
    console.log(`  改后值 yl=${distorted}`)
    const l2 = await restartAndCapture('2-distorted')
    console.log('  ── 日志原文 ──\n' + l2.map((l) => '  ' + l.trim()).join('\n'))
    const warn = l2.find((l) => l.includes('不一致')) || ''
    check('② 日志出现「发现 N 个三键不一致」', /发现 \d+ 个三键不一致/.test(warn), warn || l2.join(' | '))
    check('② 差异数正好 1(只改了一行)', /发现 1 个三键不一致/.test(warn), warn)
    check(`② 列出了改歪的那个三键 ${key}`, warn.includes(key), warn)
    check(`② 差异行给出 结存=${distorted}`, warn.includes(`结存=${Number(distorted)}`), warn)
    check(`② 差异行给出 流水=${origDec}`, warn.includes(`流水=${Number(origDec)}`), warn)

    // ── ③ 精确还原 → 必须回到「一致」 ──
    console.log('\n③ 还原该行后重启(期望:回到一致) ...')
    ps(STOP_PS)
    const n = callRestore()
    check('③ 还原语句影响 1 行', n === '1', n)
    console.log(`  还原后值 yl=${sql(`SELECT CONVERT(varchar(60), CAST(yl AS decimal(38,10)), 2) FROM kucun WHERE id = ${id};`)}`)
    const l3 = await restartAndCapture('3-restored')
    console.log('  ── 日志原文 ──\n' + l3.map((l) => '  ' + l.trim()).join('\n'))
    check('③ 日志回到「一致」', l3.some((l) => l.includes('一致')), l3.join(' | '))

    // ── ④ 还原证据:十进制串 + IEEE 位串 + 全库指纹,三者都要与基线相同 ──
    const nowDec = sql(`SELECT CONVERT(varchar(60), CAST(yl AS decimal(38,10)), 2) FROM kucun WHERE id = ${id};`)
    const nowHex = sql(`SELECT CONVERT(varchar(20), CONVERT(binary(8), yl), 2) FROM kucun WHERE id = ${id};`)
    const nowRows = num(`SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';`)
    const nowSum = num(`SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';`)
    console.log(`\n④ 还原核实: yl ${origDec} → ${nowDec}(位串 ${origHex} → ${nowHex})`)
    check(`④ 值相等(${origDec})`, nowDec === origDec, `${nowDec} vs ${origDec}`)
    check(`④ IEEE 位串相等(${origHex})`, nowHex === origHex, `${nowHex} vs ${origHex}`)
    check(`④ kucun 行数不变(${baseRows})`, nowRows === baseRows, `${nowRows} vs ${baseRows}`)
    check(`④ kucun 合计不变(${baseSum})`, Math.abs(nowSum - baseSum) < 1e-9, `${nowSum} vs ${baseSum}`)
  } finally {
    // ── 兜底:无论成败,先停服务、还原、再核实 ──
    try {
      if (perturbed) {
        console.log('\n⚠ 未走完流程,兜底还原 ...')
        ps(STOP_PS)
        callRestore()
      }
      if (restored) {
        const dec = sql(`SELECT CONVERT(varchar(60), CAST(yl AS decimal(38,10)), 2) FROM kucun WHERE id = ${id};`)
        const hex = sql(`SELECT CONVERT(varchar(20), CONVERT(binary(8), yl), 2) FROM kucun WHERE id = ${id};`)
        check(`收尾核实:kucun.id=${id} 已回到原值 ${origDec}`, dec === origDec && hex === origHex, `dec=${dec} hex=${hex}`)
      }
    } catch (e) {
      fail++
      console.log(`\n  ✗ 兜底还原失败,请手工执行:UPDATE kucun SET yl = ${origDec} WHERE id = ${id};  → ${String(e.message).split('\n')[0]}`)
    }
    // ── 把服务恢复成正常态(start-prod.ps1:幂等、隐藏窗口、不产生临时日志) ──
    try {
      ps(STOP_PS)                                    // 先停掉本探针起的(带重定向)那个实例
      ps(`& '${fw(path.join(ROOT, 'tools', 'scripts', 'start-prod.ps1'))}'`)
      let up = false
      for (let i = 0; i < 60; i++) {
        await sleep(1000)
        if (ps(`if (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue) { 'UP' } else { 'DOWN' }`) === 'UP') { up = true; break }
      }
      check('收尾:8090 已用 start-prod.ps1 恢复运行', up)
    } catch (e) {
      fail++
      console.log(`\n  ✗ 收尾重启 8090 失败: ${String(e.message).split('\n')[0]}`)
    }
    if (fail === 0) {
      try { fs.rmSync(TMP, { recursive: true, force: true }); console.log(`已清理临时日志目录 ${TMP}`) } catch (e) { console.log(`临时目录未清掉(${String(e.message).split('\n')[0]})`) }
    } else {
      console.log(`探针失败,保留临时日志以便排查:${TMP}`)
    }
  }

  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
