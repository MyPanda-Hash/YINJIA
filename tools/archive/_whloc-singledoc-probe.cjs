/* 诊断③:档案面板 singleDoc 形态探针 —— WHLOC vs INV:分页器/常驻参照编辑器/activeCell 行为 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'))

const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-singledoc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (data) => {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evalOnce = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) { await sleep(200); if (await evalOnce('document.readyState') === 'complete') { await sleep(600); return } }
    }
    await send('Page.enable')
    await navigate(`${BASE}/#/login`)
    await evalOnce(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)

    for (const p of ['WHLOC', 'INV', 'WH']) {
      await navigate('about:blank')
      await navigate(`${BASE}/#/panelx/list/${p}`)
      let ok = false
      for (let i = 0; i < 40; i++) { await sleep(300); if (await evalOnce(`document.querySelectorAll('.el-table__row').length`) > 0) { ok = true; break } }
      await sleep(800) // 等配置二次刷新/稳定
      const info = await evalOnce(`(function(){
        var q=function(s){return document.querySelectorAll(s).length};
        return JSON.stringify({rows:q('.el-table__row'), refEditors:q('.inline-ref-editor'), pagers:q('.el-pagination'), archPagerText:(function(){var pg=document.querySelector('.el-pagination');return pg? (pg.textContent||'').replace(/\\s+/g,' ').slice(0,60):''})(), firstRowEditors:q('.el-table__row td .el-input,.el-table__row td .el-select,.el-table__row td .el-switch,.el-table__row td .el-input-number')})
      })()`)
      console.log(`[${p}] rendered=${ok}`, info)
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
