/** _walk-page-debug.cjs — 检查成型工艺页面实际渲染状态 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9367
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pdbg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2500)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_MOLD_PROC' }); await sleep(5000)

  const page = await evaluate(`(() => {
    // 先点新增进入编辑态
    const addBtn = [...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')
    if (addBtn) addBtn.click()
    return 'clicked'
  })()`)
  await sleep(3000)
  const after = await evaluate(`(() => ({
    docStatus: document.querySelector('.doc-status')?.textContent?.trim(),
    hasFieldEdit: !!document.querySelector('.rs-field-edit-btn'),
    allSectionBars: [...document.querySelectorAll('.rs-sectionbar')].map(e => ({
      text: e.textContent.trim().slice(0, 20),
      hasEditBtn: !!e.querySelector('.rs-field-edit-btn'),
    })),
    sectionCount: document.querySelectorAll('.rs-t .rs-sectionbar').length,
    inputCount: document.querySelectorAll('.rs-t input, .rs-t textarea').length,
    sectionbarHTML: document.querySelectorAll('.rs-sectionbar')[2]?.innerHTML?.slice(0, 300),
  }))()`)
  console.log('after 新增: ' + JSON.stringify(after, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
