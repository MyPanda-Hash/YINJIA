/**
 * 我的桌面(DASHBOARD)展示效果审计 —— 只读
 *   ① 逐模块截图(概览/生产/库存/销售/研发/质量)
 *   ② 抓 DOM 度量:栅格/间距/字号/圆角/阴影/配色/溢出/截断
 *   ③ 另外补两档窄屏(768 / 375)看响应式
 * 不种任何数据。用法: node --experimental-websocket tools/archive/_probe-dashboard-audit.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9361
const OUT = path.join(process.env.TEMP, 'dash-audit')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!EDGE) throw new Error('找不到 Edge/Chrome')
  fs.mkdirSync(OUT, { recursive: true })

  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await lr.json()
  const token = login.data && login.data.token
  const user = login.data && login.data.user
  if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  console.log('[login] ok')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-audit-'))
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
    if (!target) throw new Error('CDP 未就绪')

    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const shot = async (name, full = true) => {
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, fromSurface: true })
      const f = path.join(OUT, name + '.png')
      if (s.result && s.result.data) fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'))
      console.log('  shot -> ' + f)
      return f
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` })
    await sleep(1800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(500)
    await send('Page.navigate', { url: `${FRONT}/#/dashboard` })
    await sleep(4000)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(1200)

    // ---- 模块页签清单 ----
    const tabs = await evaluate(`[...document.querySelectorAll('.mod-tab')].map(e => e.innerText.trim())`)
    console.log('模块页签: ' + JSON.stringify(tabs))

    for (let i = 0; i < tabs.length; i++) {
      await evaluate(`(() => { const t = document.querySelectorAll('.mod-tab')[${i}]; if (t) t.click(); return 'ok' })()`)
      await sleep(2600)
      const info = await evaluate(`(() => {
        const px = (v) => Math.round(parseFloat(v) || 0)
        const cards = [...document.querySelectorAll('.dashboard .card')]
        const grid = document.querySelector('.dashboard .dash-grid')
        const gs = grid ? getComputedStyle(grid) : null
        const kpiNums = [...document.querySelectorAll('.dashboard .kpi-num, .dashboard .lm-value')]
        const titles = [...document.querySelectorAll('.dashboard .card-title, .dashboard .kpi-title')]
        const trunc = [...document.querySelectorAll('.dashboard *')].filter(el => el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0).map(el => (el.className || el.tagName) + ' :: ' + el.innerText.trim().slice(0, 26)).slice(0, 12)
        const bg = {}, bc = {}, fs = {}
        cards.forEach(c => { const s = getComputedStyle(c); bg[s.backgroundColor] = (bg[s.backgroundColor]||0)+1; bc[s.borderTopColor] = (bc[s.borderTopColor]||0)+1 })
        titles.forEach(t => { const s = getComputedStyle(t); fs[s.fontSize] = (fs[s.fontSize]||0)+1 })
        const de = document.documentElement
        return {
          module: document.querySelector('.mod-tab.on') && document.querySelector('.mod-tab.on').innerText.trim(),
          cards: cards.length,
          grid: gs ? { cols: gs.gridTemplateColumns.split(' ').length, gap: gs.gap } : null,
          cardBoxes: cards.slice(0, 8).map(c => ({ cls: (c.className||'').replace(/card|reveal-item/g,'').trim().slice(0,26), w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), r: px(getComputedStyle(c).borderTopLeftRadius), sh: getComputedStyle(c).boxShadow.slice(0, 46), p: getComputedStyle(c).padding })),
          kpiFont: kpiNums.length ? getComputedStyle(kpiNums[0]).fontSize : null,
          kpiNumeric: kpiNums.length ? getComputedStyle(kpiNums[0]).fontVariantNumeric : null,
          titleFonts: fs,
          bgColors: bg, borderColors: bc,
          docScrollW: de.scrollWidth, docClientW: de.clientWidth, hScroll: de.scrollWidth > de.clientWidth + 1,
          trunc: trunc,
        }
      })()`)
      console.log('\n===== [' + (i + 1) + '/' + tabs.length + '] ' + (info && info.module) + ' =====')
      console.log(JSON.stringify(info, null, 1))
      await shot('dash-' + (i + 1) + '-' + (info && info.module ? encodeURIComponent(info.module) : i))
    }

    // ---- 响应式:768 / 375 各来一张(概览) ----
    await evaluate(`(() => { const t = document.querySelectorAll('.mod-tab')[0]; if (t) t.click(); return 'ok' })()`)
    await sleep(2200)
    for (const [w, h, tag] of [[768, 1024, 'pad768'], [375, 812, 'phone375']]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
      await sleep(1800)
      const m = await evaluate(`(() => { const de = document.documentElement; const cards=[...document.querySelectorAll('.dashboard .card')]; return { w: de.clientWidth, scrollW: de.scrollWidth, hScroll: de.scrollWidth > de.clientWidth + 1, cards: cards.length, cols: (()=>{const g=document.querySelector('.dash-grid'); return g? getComputedStyle(g).gridTemplateColumns.split(' ').length : null})() } })()`)
      console.log('\n[响应式 ' + tag + '] ' + JSON.stringify(m))
      await shot('dash-' + tag)
    }
    ws.close()
  } finally {
    edge.kill()
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
