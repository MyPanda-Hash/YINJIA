/**
 * _align-precise.cjs — 碱性面板逐列 X 坐标比对(表头 vs 每个数据行)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9339
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-prec-'))
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
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(900); return } }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${FRONT}/#/panelx/list/RD_ALKALINE`)
    await sleep(3200)
    const out = await evaluate(`(() => {
  const dt = document.querySelector('.rsp-sheet table.rs-dt')
  const rows = [...dt.querySelectorAll(':scope > tbody > tr')]
  const hdrRow = rows.find((r) => r.querySelector('th'))
  const hdrX = [...hdrRow.children].map((c) => Math.round(c.getBoundingClientRect().left))
  const dataRows = rows.filter((r) => !r.querySelector('th') && ![...r.children].some((c) => c.classList.contains('rs-sectionbar') || c.classList.contains('rs-subhead') || c.classList.contains('rs-empty')))
  const report = dataRows.map((r, i) => {
    const xs = [...r.children].map((c) => Math.round(c.getBoundingClientRect().left))
    const bad = xs.map((x, j) => Math.abs(x - hdrX[j]) > 1 ? j : -1).filter((j) => j >= 0)
    return { row: i, cells: xs.length, misCols: bad }
  })
  return { headerCells: hdrX.length, hdrX, report }
})()`)
    console.log('表头列数:', out.headerCells)
    console.log('表头X:', out.hdrX.join(','))
    let allOk = true
    for (const r of out.report) {
      if (r.cells !== out.headerCells || r.misCols.length) { allOk = false; console.log('数据行' + r.row + ': cells=' + r.cells + ' 错位列=' + JSON.stringify(r.misCols)) }
    }
    console.log(allOk ? '✓ 全部数据行与表头逐列对齐' : '✗ 仍有错位')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
