/**
 * _grid-align-audit.cjs — v3:用真实单元格边缘(节条行/表头行)比对表格边界与首列分界
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9342
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-grid3-'))
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
    for (const pc of ['RD_ALKALINE', 'RD_ANTIBACT', 'RD_SOAK', 'RD_SCALE', 'RD_RO_PROTECT', 'RD_DROP_PREC', 'RD_MINERAL']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3200)
      const out = await evaluate(`(() => {
  const top = [...document.querySelectorAll('.rsp-sheet > table.rs-t, .rsp-sheet .rsp-dt-table > table.rs-t')]
  const rows = top.map((t, i) => {
    // 节条行(全宽 colspan)= 表格真实边界;标签行第一格右缘 = 首列分界
    const bar = t.querySelector(':scope > tbody > tr .rs-sectionbar')
    const barR = bar ? bar.getBoundingClientRect() : null
    const labRow = [...t.querySelectorAll(':scope > tbody > tr')].find((tr) => tr.children[0] && (tr.children[0].classList.contains('rs-label') || tr.children[0].classList.contains('rs-th')))
    const labR = labRow ? labRow.children[0].getBoundingClientRect() : null
    return { i, left: barR ? +barR.left.toFixed(1) : null, right: barR ? +barR.right.toFixed(1) : null, col1: labR ? +labR.right.toFixed(1) : null }
  })
  const lefts = [...new Set(rows.map((r) => r.left))]
  const rights = [...new Set(rows.map((r) => r.right))]
  const col1s = [...new Set(rows.map((r) => r.col1).filter(Boolean))]
  return { n: rows.length, lefts, rights, col1s, rows }
})()`)
      const ok = out.lefts.length === 1 && out.rights.length === 1 && (out.col1s.length === 1 || out.col1s.every((v) => Math.abs(v - out.col1s[0]) <= 2))
      console.log('[grid] ' + pc + ': tables=' + out.n +
        ' 左=' + out.lefts.join('/') + ' 右=' + out.rights.join('/') + ' 首列分界=' + out.col1s.join('/') + (ok ? ' ✓' : ' ✗'))
      if (!ok) console.log('   detail:', JSON.stringify(out.rows))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
