/** _walk-opcheck.cjs — 编辑态 ＋/× 按钮可见性(0 宽操作列) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9359
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PC = process.argv[2] || 'RD_MOLD_FORMULA'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ops-'))
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
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/' + PC }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  // 检查已有单据(非新增,有数据行)
  const ops = await evaluate(`(() => {
    const cells = [...document.querySelectorAll('.rs-td-op')]
    return cells.slice(0, 5).map(td => {
      const r = td.getBoundingClientRect()
      const add = td.querySelector('.rs-op-add')
      const del = td.querySelector('.rs-op-del')
      return {
        cellW: Math.round(r.width),
        cellR: Math.round(r.right),
        addVisible: add ? (add.getBoundingClientRect().width > 0 && getComputedStyle(add).display !== 'none') : false,
        delVisible: del ? (del.getBoundingClientRect().width > 0 && getComputedStyle(del).display !== 'none') : false,
      }
    })
  })()`)
  console.log('OP CELLS: ' + JSON.stringify(ops))
  // 新增行按钮可见性
  const addBar = await evaluate(`(() => { const a = document.querySelector('.rs-add'); if (!a) return null; const r = a.getBoundingClientRect(); return { w: Math.round(r.width), visible: r.width > 0 } })()`)
  console.log('ADD BAR: ' + JSON.stringify(addBar))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
