/**
 * _record-sheets-audit.cjs — DOM 视觉审计:关键样式取值(标签灰底/粉节条/灰表头/标题字体/矿化图表)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9335
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await loginRes.json()
  const token = login.data.token

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-audit-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(500); return } }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')

    for (const pc of ['RD_ALKALINE', 'RD_MINERAL', 'RD_SOAK', 'RD_SCALE']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3000)
      const audit = await evaluate(`(() => {
  const gs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null }
  const out = {}
  out.labelBg = gs('.rsp-sheet .rs-label', 'backgroundColor')
  out.sectionBg = gs('.rsp-sheet .rs-sectionbar', 'backgroundColor')
  out.thBg = gs('.rsp-sheet .rs-th', 'backgroundColor')
  out.thColor = gs('.rsp-sheet .rs-th', 'color')
  out.companyFont = gs('.rsp-sheet .rs-company-cell', 'fontFamily')
  out.topicSize = gs('.rsp-sheet .rs-topic', 'fontSize')
  out.sheetWidth = gs('.rsp-sheet', 'width')
  out.tdBorder = gs('.rsp-sheet .rs-td', 'borderTopColor')
  // 两级表头
  const grp1 = document.querySelectorAll('.rsp-sheet .rs-grp > .rs-th')
  const grp2 = document.querySelectorAll('.rsp-sheet .rs-grp2 > .rs-th')
  out.headL1 = [...grp1].map(e => e.textContent.trim() + (e.rowSpan === 2 ? '(r2)' : 'x' + e.colSpan)).join('/')
  out.headL2 = [...grp2].map(e => e.textContent.trim()).join('/')
  // 矿化图表
  out.polylines = document.querySelectorAll('.rsp-chart polyline').length
  out.legendText = [...document.querySelectorAll('.rsp-chart .rsp-legend')].map(e => e.textContent).join('|')
  // 首尾数据行文本抽查
  const rows = [...document.querySelectorAll('.rsp-sheet .rs-dt tbody tr')]
  out.lastRowText = rows[rows.length - 1]?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 110)
  // 浸泡安全特例块
  out.waterLabels = [...document.querySelectorAll('.rsp-sheet .rs-ind-name')].map(e => e.textContent.trim()).join('|')
  out.soakInstHeads = [...document.querySelectorAll('.rsp-sheet .rsp-thin')].map(e => e.textContent.trim()).join('|')
  return out
})()`)
      console.log('[audit] ' + pc)
      for (const [k, v] of Object.entries(audit)) if (v !== null && v !== '' && v !== undefined) console.log('  ' + k + ' = ' + JSON.stringify(v))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
