/* 单个路由的 API 请求分解(Network 事件,按路径归组)
   用法: node tools/archive/_route-requests.cjs "/panelx/form/SO_ORDER" [秒数] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const ROUTE = process.argv[2] || '/panelx/form/SO_ORDER'
const WAIT = Number(process.argv[3] || 6)
const PORT = 9448
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://localhost:8090'
const BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-r-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const reqs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      if (m.method === 'Network.requestWillBeSent') {
        const u = m.params.request.url
        if (u.includes('/api/')) reqs.push({ url: u.replace(BASE, ''), t: Date.now(), type: m.params.type })
      }
    }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    // 先落到列表页,再切表单(模拟真实操作路径)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/SO_ORDER` }); await sleep(5000)
    reqs.length = 0
    const t0 = Date.now()
    await evaluate(`location.hash = '#${ROUTE}'; 'ok'`)
    await sleep(WAIT * 1000)
    const by = {}
    for (const r of reqs) { const key = r.url.split('?')[0]; by[key] = (by[key] || 0) + 1 }
    const total = reqs.length
    const span = reqs.length ? Math.round((reqs[reqs.length - 1].t - reqs[0].t)) : 0
    console.log(`路由 ${ROUTE} 切换后 ${WAIT}s 内 /api 请求 ${total} 个,请求跨度 ${span}ms`)
    console.log('按路径分解:')
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)} × ${k}`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
