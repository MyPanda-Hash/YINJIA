/**
 * _soak-seed-check.cjs — 浸泡安全草稿 17 项标准卫生项目自动预填验证
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-seed-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9347', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9347/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2200)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(500)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_SOAK' })
    await sleep(4200)
    const out = await ev(`(() => {
  const rows = [...document.querySelectorAll('.rsp-sheet .rs-dt tbody tr')].filter((tr) =>
    !tr.querySelector('.rs-sectionbar, .rs-subhead, .rs-th') && tr.textContent.trim() !== '—')
  return { rows: rows.length, first: rows[0] ? rows[0].textContent.trim().slice(0, 36) : null, last: rows.length ? rows[rows.length - 1].textContent.trim().slice(0, 24) : null }
})()`)
    console.log('浸泡安全草稿预填:', JSON.stringify(out))
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
