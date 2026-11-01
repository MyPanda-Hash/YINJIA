/** probe-layout.cjs — 量化横向滚动/裁切(桌面 1440x900 与窄屏 390x844),页面只读不发写请求 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const API = 'http://127.0.0.1:8090'
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MEASURE = `(() => {
  const de = document.documentElement
  const pfc = document.querySelector('.pfc')
  const list = document.querySelector('.pfc-list')
  const tblWrap = document.querySelector('.pfc-list .el-scrollbar__wrap') || document.querySelector('.pfc-list .el-table__body-wrapper')
  const bar = document.querySelector('.pfc-bar')
  const tabs = document.querySelector('.pfc-tabs .el-tabs__header')
  const r = (e) => e ? e.getBoundingClientRect() : null
  const clip = (e) => { const b = r(e); return e ? { right: Math.round(b.right), overflowRight: Math.round(b.right - window.innerWidth) } : null }
  return {
    innerW: window.innerWidth, innerH: window.innerHeight,
    docScrollW: de.scrollWidth, bodyScrollW: document.body.scrollWidth,
    pageHorizontalScroll: de.scrollWidth > window.innerWidth + 1,
    pfc: pfc ? { scrollW: pfc.scrollWidth, clientW: pfc.clientWidth, hScroll: pfc.scrollWidth > pfc.clientWidth + 1 } : null,
    listTable: list ? { scrollW: list.scrollWidth, clientW: list.clientWidth } : null,
    tableInnerScroll: tblWrap ? { scrollW: tblWrap.scrollWidth, clientW: tblWrap.clientWidth, hScroll: tblWrap.scrollWidth > tblWrap.clientWidth + 1 } : null,
    bar: clip(bar), tabs: clip(tabs),
    tabItems: [...document.querySelectorAll('.pfc-tabs .el-tabs__item')].map(e => ({ t: e.textContent.trim(), right: Math.round(e.getBoundingClientRect().right) })),
  }
})()`

async function main() {
  const login = await (await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfc-lay-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const res = {}
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0; const pend = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u, w = 2500) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break } await sleep(w) }
    await send('Page.enable'); await send('Runtime.enable')
    for (const [label, w, h, mobile] of [['desktop-1440x900', 1440, 900, false], ['narrow-390x844', 390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
      await nav(API + '/#/login', 800)
      await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
      await nav('about:blank', 200)
      await nav(API + '/#/prod/plan/procFlowCard', 3000)
      for (let i = 0; i < 25 && !(await ev(`document.querySelectorAll('.pfc-list .el-table__row').length`)); i++) await sleep(400)
      res[label] = await ev(MEASURE)
      console.log(`\n=== ${label} ===`)
      console.log(JSON.stringify(res[label], null, 1))
    }
    ws.close()
  } finally { edge.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  fs.writeFileSync(path.join(__dirname, 'layout-result.json'), JSON.stringify(res, null, 2), 'utf8')
}
main().catch((e) => { console.error(e); process.exit(1) })
