/**
 * 临时探针(2026-09-22):桌面右上角快捷入口"可自定义"的端到端核对
 *   A 全新浏览器(无存储)→ 管理员应看到 5 个按钮
 *   B 老用户(v1 存储,只勾了快速报工,且关掉了 KPI 卡)→ 打开桌面后自动补 项目申请/产品开发,
 *     用户自己的勾选与开关不被改动,存储里 v 升到 2
 *   C 点「项目申请」→ 落到 /panelx/form/RD_APPROVAL 且是"新增"态
 *   D 工作台设置弹窗:勾选项来自同一份候选清单,且按权限过滤
 * 用法: node --experimental-websocket tools/archive/_probe-desk-quick.cjs [FRONT]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9367
const OUT = path.join(process.env.TEMP, 'dash-audit')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
function chk(name, ok, extra) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra)))
  if (!ok) fails++
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await lr.json()
  const token = login.data && login.data.token
  const user = login.data && login.data.user
  if (!token) throw new Error('登录失败')
  console.log('[login] ok  isAdmin=' + user.isAdmin + ' visiblePanels=' + (user.visiblePanels || []).length)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-quick-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        target = list.find((t) => t.type === 'page')
      } catch { /* not ready */ }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) console.log('  [eval error] ' + r.result.exceptionDetails.text)
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const shot = async (name) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, name + '.png')
      if (s.result && s.result.data) fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'))
      console.log('  shot -> ' + f)
    }
    const loginStorage = `localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-22');`
    const openDashboard = async () => {
      await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1600)
      await evaluate(loginStorage + ' "ok"')
      await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
      await send('Page.navigate', { url: `${FRONT}/#/dashboard` }); await sleep(4200)
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
      await sleep(1000)
    }
    const quickTexts = async () => evaluate(`[...document.querySelectorAll('.quick .el-button')].map(b => b.innerText.trim())`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    console.log('\nA. 全新浏览器(管理员,无历史设置)')
    await openDashboard()
    const a = await quickTexts()
    chk('右上角 5 个入口(含项目申请/产品开发)', JSON.stringify(a) === JSON.stringify(['新建加工单', '快速报工', '生产看板', '项目申请', '产品开发']), a)
    const storeA = await evaluate(`localStorage.getItem('mes_desk_settings')`)
    chk('预设已落盘且带版本号 v=2', !!storeA && JSON.parse(storeA).v === 2, storeA)
    await shot('quick-a-fresh-admin')

    console.log('\nB. 老用户(v1 存储:只勾快速报工 + KPI 卡关闭)')
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1600)
    await evaluate(`localStorage.setItem('mes_desk_settings', JSON.stringify({ quick: ['quickReport'], showKpi: false, showProgress: true, showTodo: true })); ${loginStorage} 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FRONT}/#/dashboard` }); await sleep(4200)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1000)
    const b = await quickTexts()
    chk('自动补上 项目申请/产品开发,原有勾选保留', JSON.stringify(b) === JSON.stringify(['快速报工', '项目申请', '产品开发']), b)
    const storeB = await evaluate(`JSON.parse(localStorage.getItem('mes_desk_settings'))`)
    chk('存储升到 v=2 且未打开用户关掉的 KPI 卡', storeB.v === 2 && storeB.showKpi === false, storeB)
    const kpiVisible = await evaluate(`document.querySelectorAll('.live-metric').length`)
    chk('用户关掉的 KPI 卡确实没渲染', kpiVisible === 0, kpiVisible)

    console.log('\nC. 点「项目申请」→ 立项申请表新增')
    const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('.quick .el-button')].find(x => x.innerText.trim() === '项目申请'); if (!b) return 'NOT-FOUND'; b.click(); return 'clicked' })()`)
    chk('按钮可点', clicked === 'clicked', clicked)
    await sleep(3200)
    const hashC = await evaluate(`location.hash`)
    chk('落到 /panelx/form/RD_APPROVAL', hashC.includes('/panelx/form/RD_APPROVAL'), hashC)
    const isNew = await evaluate(`document.body.innerText.includes('（新增）')`)
    chk('是"新增"态(显示（新增）)', isNew === true)
    await shot('quick-c-rd-approval-new')

    console.log('\nD. 工作台设置弹窗候选')
    await send('Page.navigate', { url: `${FRONT}/#/dashboard` }); await sleep(3800)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(800)
    await evaluate(`(() => { const t = document.querySelector('.user, .el-dropdown .show-name'); if (t) t.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return 'ok' })()`)
    await sleep(900)
    const menuOpened = await evaluate(`(() => { const items = [...document.querySelectorAll('.el-dropdown-menu__item')]; const d = items.find(i => i.innerText.includes('工作台设置')); if (!d) return 'NO-ITEM:' + items.map(i=>i.innerText.trim()).join('|'); d.click(); return 'clicked' })()`)
    console.log('   打开设置 = ' + menuOpened)
    await sleep(1200)
    const boxes = await evaluate(`[...document.querySelectorAll('.desk-setting .el-checkbox')].map(c => c.innerText.trim())`)
    chk('勾选项 = 候选清单 5 项', JSON.stringify(boxes) === JSON.stringify(['新建加工单', '快速报工', '生产看板', '项目申请', '产品开发']), boxes)
    const tip = await evaluate(`(() => { const t = document.querySelector('.desk-setting .set-tip'); return t ? t.innerText.trim() : null })()`)
    chk('写明按权限过滤的提示', !!tip && tip.includes('权限'), tip)
    const checked = await evaluate(`[...document.querySelectorAll('.desk-setting .el-checkbox.is-checked')].map(c => c.innerText.trim())`)
    chk('勾选状态与桌面按钮一致', JSON.stringify(checked) === JSON.stringify(['快速报工', '项目申请', '产品开发']), checked)
    await shot('quick-d-desk-settings')
  } finally {
    edge.kill()
  }
  console.log(fails ? '\n结果:' + fails + ' 项未通过' : '\n结果:全部通过')
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error('FAIL: ' + (e && e.message)); process.exit(1) })
