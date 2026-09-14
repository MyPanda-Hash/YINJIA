/**
 * _dp-diag.cjs — 压降精度列宽诊断:各表每列实测宽度
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9343
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dp-'))
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
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${FRONT}/#/panelx/list/RD_DROP_PREC`)
    await sleep(3200)
    const out = await evaluate(`(() => {
  const sheet = document.querySelector('.rsp-sheet')
  const top = [...document.querySelectorAll('.rsp-sheet > table.rs-t, .rsp-sheet .rsp-dt-table > table.rs-t')]
  const diag = top.map((t, i) => {
    const r = t.getBoundingClientRect()
    const cols = [...t.querySelectorAll(':scope > colgroup > col')]
    const colW = cols.map((c) => {
      const rect = c.getBoundingClientRect()
      return rect.width || parseFloat(c.style.width) || 0
    })
    // 找一行"每列独立"的行取实际格宽:数据表=组子行或数据行;条件区=标签行
    let cellW = null
    const dtRow = [...t.querySelectorAll(':scope > tbody > tr')].find((tr) => {
      const cs = [...tr.children]
      return cs.length >= 5 && cs.every((c) => (c.colSpan || 1) === 1)
    })
    if (dtRow) cellW = [...dtRow.children].map((c) => +c.getBoundingClientRect().width.toFixed(1))
    return { i, cls: t.className, left: +r.left.toFixed(1), width: +r.width.toFixed(1), colCount: cols.length, colW: colW.map((w) => +w.toFixed(1)), cellW }
  })
  return { sheetW: +sheet.getBoundingClientRect().width.toFixed(1), sheetMax: getComputedStyle(sheet).maxWidth, diag }
})()`)
    console.log('sheet width=' + out.sheetW + ' maxWidth=' + out.sheetMax)
    for (const d of out.diag) {
      console.log('t' + d.i + ' [' + d.cls + '] left=' + d.left + ' w=' + d.width + ' cols=' + d.colCount)
      console.log('   col宽: ' + d.colW.join(','))
      if (d.cellW) console.log('   格宽: ' + d.cellW.join(','))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
