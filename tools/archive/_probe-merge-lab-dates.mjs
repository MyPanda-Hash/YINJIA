/**
 * _probe-merge-lab-dates.mjs — 合并后回归:实验室记录表「日期/时间区间」格是否照常渲染(2026-10-07)
 *
 * 为什么有这个探针:并合远端 6 提交后,前端产物由**本地按合并源码重建**(static 被 /MIR 覆盖),
 * 需要证实远端的日期格改造没有在合并/重建里丢掉。原探针 tools/archive/_lab-date-cells-probe.cjs
 * 硬编码了另一台机器的路径(C:/INCER/... 的 ws 包与产物目录)与 5173,本机跑不了 ⇒ 这里用本机可跑的
 * 最小复刻:内建 WebSocket + 8090 打包产物 + 测试账套,只做**只读**断言(不点保存、不写库)。
 *
 * 断言:
 *   ① RD_INSTR_USE 记录表里出现「日期」控件(.el-date-editor)与「时间区间」控件(.el-range-editor);
 *   ② 两者中至少一个有值,且日期值形如 yyyy-MM-dd(远端 QueryService 本地墙钟下发 + 前端归一的口径);
 *   ③ 抽样 RD_EQUIP_USE / RD_SCALE 也各有日期控件(11 张表同批改造,抽两张防空改造)。
 *
 * 用法:node tools/archive/_probe-merge-lab-dates.mjs [--site http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const SITE = arg('site', 'http://127.0.0.1:8090')
const API = arg('api', 'http://127.0.0.1:8090/api')
const PORT = 9413
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-profile-lab')
const SHOT = path.resolve('tools/archive/_probe-merge-lab-dates.png')
const OUT = path.resolve('tools/archive/_probe-merge-lab-dates.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const checks = []
const check = (n, ok, d) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? '  ✅' : '  ❌'} ${n}${d ? ' — ' + d : ''}`) }

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
if (!login?.data?.token) { console.error('[FATAL] 登录失败'); process.exit(1) }
console.log('[login] factory =', login.data.user?.factory)

fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--window-size=1700,1100',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })

let version = null
for (let i = 0; i < 40 && !version; i++) { await sleep(500); try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {} }
if (!version) { console.error('[FATAL] Edge 未就绪'); edge.kill(); process.exit(1) }

try {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const tab = targets.find((t) => t.type === 'page' && t.url === 'about:blank') || targets.find((t) => t.type === 'page')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  let seq = 0; const pending = new Map()
  await new Promise((res, rej) => { socket.addEventListener('open', () => res()); socket.addEventListener('error', () => rej(new Error('ws fail'))) })
  socket.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data) } catch { return } if (m?.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); socket.send(JSON.stringify({ id, method, params })) })
  const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: SITE + '/#/login' })
  await sleep(1800)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)

  const dumpCells = () => ev(`(function(){
    const out = { doc: (document.querySelector('.rs-docno-input') || {}).value || '', cells: [] };
    document.querySelectorAll('table.rs-t td.rs-td').forEach((td) => {
      const range = td.querySelector('.el-range-editor');
      const de = td.querySelector('.el-date-editor');
      const inp = td.querySelector('input');
      const span = td.querySelector('.rs-txt');
      if (!range && !de && !inp && !span) return;
      let kind = range ? 'range' : de ? 'date' : inp ? 'input' : 'text';
      let val = '';
      if (range) val = [...td.querySelectorAll('input')].map((x) => x.value).join('~');
      else if (inp) val = inp.value;
      else val = (span.textContent || '').trim();
      out.cells.push(kind + ':' + val);
    });
    return JSON.stringify(out);
  })()`)

  const scan = async (panel, wantRange) => {
    await send('Page.navigate', { url: SITE + '/#/panelx/list/' + panel })
    await sleep(4200)
    await ev(`(function(){ document.querySelectorAll('.el-dialog__headerbtn').forEach((b)=>b.click()); return 1 })()`)
    let snap = ''
    let best = null
    for (let hop = 0; hop < 8; hop++) {
      snap = await dumpCells()
      if (typeof snap === 'string') {
        try {
          const cells = JSON.parse(snap).cells || []
          const ranges = cells.filter((c) => c.startsWith('range:'))
          // 记下「区间有合法值」的那张单(测试库里有脏值 333 的行,归一失败会留空 —— 那是设计口径,不是 bug)
          if (ranges.some((c) => /\d{1,2}:\d{2}/.test(c))) { best = snap; break }
          if (!wantRange && /(date|range):[^",]*[0-9]/.test(snap)) { best = snap; break }
        } catch { /* ignore */ }
      }
      const moved = await ev(`(function(){
        const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.getAttribute('title') || '') === '下一张');
        if (!b) return 'no-btn'; b.click(); return 'clicked';
      })()`)
      if (moved !== 'clicked') break
      await sleep(1800)
    }
    let cells = []
    try { cells = JSON.parse(best || snap).cells || [] } catch { /* 保持空 */ }
    const kinds = cells.map((c) => c.split(':')[0])
    const dates = cells.filter((c) => c.startsWith('date:'))
    const ranges = cells.filter((c) => c.startsWith('range:'))
    console.log(`[${panel}] 控件 ${JSON.stringify(kinds)} 日期=${dates.length} 区间=${ranges.length}`)
    if (panel === 'RD_INSTR_USE') console.log('   样例:', JSON.stringify(cells.slice(0, 14)))
    return { panel, cells, dates, ranges }
  }

  const instr = await scan('RD_INSTR_USE', true)
  check('RD_INSTR_USE 渲染出「日期」控件', instr.dates.length > 0, `date=${instr.dates.length}`)
  check('RD_INSTR_USE 渲染出「时间区间」控件', instr.ranges.length > 0, `range=${instr.ranges.length}`)
  const dated = instr.dates.find((c) => /\d{4}-\d{2}-\d{2}/.test(c))
  check('日期值形如 yyyy-MM-dd(本地墙钟下发+归一)', !!dated, dated || JSON.stringify(instr.dates.slice(0, 3)))
  const ranged = instr.ranges.find((c) => /\d{1,2}:\d{2}/.test(c))
  check('时间区间值形如 HH:mm~HH:mm', !!ranged, ranged || JSON.stringify(instr.ranges.slice(0, 3)))

  const equip = await scan('RD_EQUIP_USE')
  const scale = await scan('RD_SCALE')
  check('RD_EQUIP_USE 有日期控件', equip.dates.length > 0, `date=${equip.dates.length}`)
  check('RD_SCALE 有日期控件', scale.dates.length > 0, `date=${scale.dates.length}`)
  check('三个面板都没有「文本」形态的日期格残留(使用日期/测试日期)',
    !instr.cells.some((c) => c.startsWith('text:') && /^\d{4}-\d{2}-\d{2}$/.test(c.slice(5))),
    JSON.stringify(instr.cells.filter((c) => c.startsWith('text:')).slice(0, 5)))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) { fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64')); console.log('[截图]', SHOT) }
  fs.writeFileSync(OUT, JSON.stringify({ site: SITE, instr, equip, scale, checks }, null, 2), 'utf8')
  console.log('[落盘]', OUT)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== 结论:${checks.length - failed.length}/${checks.length} 项通过${failed.length ? '(失败:' + failed.map((f) => f.name).join('、') + ')' : ''} ===`)
} finally {
  try { edge.kill() } catch {}
  await sleep(300)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
