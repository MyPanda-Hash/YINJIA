/*
 * _verify-sched-cross-page.mjs — 复现/回归「生产工单排产后,快速排产(已打开的页签)仍显示未排产」
 *
 * 【用户报障】在 生产工单 处对工单排产后,快速排产 中该条单据不会切换为已排产(两处应一致)。
 * 【根因】PortalLayout 的 <router-view> 外包了 <keep-alive> ⇒ 已打开的「快速排产」页切走再切回
 *   **不会重新取数**(只有手点「刷新」才变)⇒ 该单仍挂在①待排产池。
 * 【断言】用与「生产工单→排产」同一条后端链路(/px/scheduleBoard/preplan)排掉目标行后,
 *   SPA 内切到生产工单再切回快速排产(不刷新页面):
 *     ① 立即重新取数(Network 上有 POST /px/scheduleBoard/pending)
 *     ② ①待排产池不再含**该物理行**(按 工单号+行号+排产数量 认行)
 *     ③ ②已排产含该行
 *   反向:切回生产工单页也应重新取数(两处口径一致)。
 *
 * ⚠ 数据:测试账套(factory=YJ_TEST,库 HSDZ_MES_TEST);排产是写操作,用 --wo/--xc/--id 指定可弃的测试行。
 * 用法: node tools/archive/_verify-sched-cross-page.mjs [navUrl] [--api=http://127.0.0.1:8090]
 *        [--wo=MO-2026-09-0007] [--xc=2] [--id=36] [--qty=70]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : dflt
}
const NAV = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:5173').replace(/\/$/, '')
const API = arg('api', 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = arg('wo', 'MO-2026-09-0007')
const XC = arg('xc', '2')
const ROWID = Number(arg('id', '36'))
const QTY = Number(arg('qty', '70'))
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (p, b) => (await fetch(`${API}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()

console.log(`页面=${NAV}  接口=${API}  目标=${WO}#${XC}(行id ${ROWID}, 排产数量 ${QTY})`)

// ── 前置:把目标行退回池中 ──
const undo = await post('/px/scheduleBoard/unassign', { rows: [{ 加工单号: WO, 行id: ROWID, 工单行号: Number(XC) }] })
console.log('前置 撤销排产:', JSON.stringify(undo.data || undo.message))
const pool0 = (await post('/px/scheduleBoard/pending', { keyword: `${WO}#${XC}` })).data || []
ok('前置:后端①待排产池有目标行', pool0.some((r) => Number(r['行id']) === ROWID), JSON.stringify(pool0.map((r) => r['行id'])))

// ── 浏览器 ──
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cross-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1100',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map(); const reqs = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url)
  }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } } }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

  await navigate(`${NAV}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale', 'zh-CN'); localStorage.setItem('mes_init_done', '1'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${NAV}/#/prod/plan/scheduleBoard`)
  await sleep(5000)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b) b.click(); return 'x' })()`)
  await sleep(800)

  /** ①/② 表格里每行的单元格文本(数组)。⚠ 首列是勾选框(td 空)⇒ 业务列从 index 1 起算:
   *  ① 待排产池: 3=加工单号 4=工单行号 12=需求数量 13=排产数量
   *  ② 已排产  : 3=加工单号 4=工单行号 7=排产数量 8=需求数量 */
  const rowsJs = (i) => `(() => { const b=[...document.querySelectorAll('.sb-block')][${i}];
      const t=b?b.querySelectorAll('.el-table__body tbody tr'):[];
      return [...t].map(r=>[...r.querySelectorAll('td')].map(c=>c.innerText.replace(/\\s+/g,' ').trim())) })()`
  const isTargetPool = (c) => c[3] === WO && c[4] === String(XC) && c[13] === String(QTY)
  const isTargetToday = (c) => c[3] === WO && c[4] === String(XC) && c[7] === String(QTY)

  const before = await evaluate(rowsJs(0))
  const targetBefore = (before || []).find(isTargetPool)
  console.log('① 排产前 待排产池:', targetBefore ? targetBefore.join(' | ') : '(未列出目标行)')
  ok('快速排产①池(页面):排产前含目标行', !!targetBefore)

  // 用「生产工单→排产」同一条后端链路排掉该行
  const steps = ((await post('/px/scheduleBoard/routeSteps', { 加工单号: WO, 行id: ROWID })).data || {})['工序步骤'] || []
  ok('目标行有工艺路线步骤', steps.length > 0, `steps=${steps.length}`)
  const lines = ((await post('/px/scheduleBoard/stats', {})).data || {})['产线'] || []
  const pick = (shop) => (lines.find((l) => String(l['生产车间'] || '') === shop) || lines[0])['生产线']
  const pre = await post('/px/scheduleBoard/preplan', {
    加工单号: WO, 行id: ROWID,
    步骤: steps.map((s) => ({ 工序: s['工序'], 生产线: pick(String(s['生产车间'] || '')), 计划完工日期: '2026-10-25' })),
  })
  ok('排产后端回执=已排产', !!pre.data?.['排产产线'], JSON.stringify(pre.data || pre.message))

  // ① SPA 内切到生产工单(应重新取数), ② 再切回快速排产(应重新取数)
  reqs.length = 0
  await evaluate(`location.hash = '#/prod/plan/workOrderList'`)
  await sleep(4500)
  ok('切到生产工单页:重新取数(POST /px/workOrderList)',
    reqs.some((u) => u.includes('/api/px/workOrderList')), reqs.filter((u) => u.includes('/api/px/')).join(' , '))

  reqs.length = 0
  await evaluate(`location.hash = '#/prod/plan/scheduleBoard'`)
  await sleep(4000)
  ok('切回快速排产页:重新取数(POST /px/scheduleBoard/pending)',
    reqs.some((u) => u.includes('/px/scheduleBoard/pending')), reqs.filter((u) => u.includes('/api/px/')).join(' , '))

  const after = await evaluate(rowsJs(0))
  const afterToday = await evaluate(rowsJs(1))
  console.log('① 切回后 待排产池:', (after || []).map((c) => c.join('|')).join(' ⏐ ') || '(空)')
  console.log('② 切回后 已排产  :', (afterToday || []).map((c) => c.join('|')).join(' ⏐ ') || '(空)')
  ok('切回后①池已去掉该行(修复点)', !(after || []).some(isTargetPool),
    '仍列出 ⇒ 页签缓存未重新取数')
  ok('切回后②已排产含该行', (afterToday || []).some(isTargetToday),
    (afterToday || []).map((c) => c.join('|')).join(' ⏐ '))

  fs.writeFileSync('tools/archive/_verify-sched-cross-page.png',
    Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result.data, 'base64'))
} finally {
  edge.kill()
}
console.log(`\n结果: pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
