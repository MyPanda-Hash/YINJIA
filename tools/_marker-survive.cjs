// _marker-survive.cjs — 最小化后恢复时,页面是否被重载过(__marker 消失=发生 reload/crash 自动恢复)
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROD_INFO'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ms-'))
  const edge = spawn(EDGE, ['--no-first-run', '--window-size=1400,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav(`${BASE}/${PAGE}`)
    await sleep(3500)
    await ev(`window.__marker = 'ALIVE-' + Date.now(); 'set'`)
    const bodyLen0 = await ev('document.body.innerHTML.length')
    console.log('最小化前: body=' + bodyLen0 + ' 字符, marker=' + await ev('window.__marker'))
    try { execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }) } catch (e) {}
    await sleep(1000)
    const bodyLen1 = await ev('document.body.innerHTML.length')
    console.log('恢复后: body=' + bodyLen1 + ' 字符, marker=' + await ev('window.__marker || "(消失→页面被重载)"') + ', hash=' + await ev('location.hash'))
    // 检查 Edge 日志:是否有渲染器崩溃
    try {
      const crash = execSync('powershell -NoProfile -Command "Get-WinEvent -Application -MaxEvents 40 2>$null | Where-Object {$_.Message -match \'msedge|Edge\'} | Select-Object -First 3 -ExpandProperty Message"', { encoding: 'utf8', timeout: 15000 })
      console.log('应用事件日志:', crash || '(无)')
    } catch {}
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
