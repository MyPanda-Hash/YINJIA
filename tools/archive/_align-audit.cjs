/**
 * _align-audit.cjs — 行对齐审计:每张 .rs-t 表内各行首格左边缘与列结构一致性
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9338
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-align-'))
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
    for (const pc of ['RD_ALKALINE', 'RD_ANTIBACT', 'RD_SOAK', 'RD_SCALE', 'RD_RO_PROTECT', 'RD_DROP_PREC', 'RD_MINERAL']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3200)
      const out = await evaluate(`(() => {
  const tables = [...document.querySelectorAll('.rsp-sheet .rs-t')]
  const problems = []
  tables.forEach((tb, ti) => {
    const rows = [...tb.querySelectorAll('tr')]
    // 每行:列跨度合计(粗略,忽略跨行)应等于表格解析列数
    const spans = rows.map((r) => [...r.children].reduce((s, c) => s + (c.colSpan || 1), 0))
    const maxSpan = Math.max(...spans)
    rows.forEach((r, ri) => {
      const s = [...r.children].reduce((a, c) => a + (c.colSpan || 1), 0)
      if (s !== maxSpan) problems.push('table' + ti + ' row' + ri + ' span=' + s + '/' + maxSpan)
    })
    // 数据表:首数据行首格左边缘 == 表头行首格左边缘
    const thRow = rows.find((r) => r.querySelector('th'))
    if (thRow) {
      const dataRows = rows.filter((r) => !r.querySelector('th') && ![...r.children].some((c) => c.classList.contains('rs-sectionbar')) && ![...r.children].some((c) => c.classList.contains('rs-subhead')) && ![...r.children].some((c) => c.classList.contains('rs-empty')))
      if (dataRows.length) {
        const thL = thRow.children[0].getBoundingClientRect().left
        const d0L = dataRows[0].children[0].getBoundingClientRect().left
        if (Math.abs(thL - d0L) > 1) problems.push('table' + ti + ' 首数据行错位 thL=' + thL.toFixed(0) + ' d0L=' + d0L.toFixed(0))
      }
    }
  })
  return { tables: tables.length, problems }
})()`)
      console.log('[align] ' + pc + ': tables=' + out.tables + (out.problems.length ? ' PROBLEMS: ' + out.problems.join(' ; ') : ' ✓ 全部对齐'))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
