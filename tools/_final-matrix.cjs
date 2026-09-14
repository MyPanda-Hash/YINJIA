// _final-matrix.cjs — 最终定位矩阵:
//   A. 登录页(去 backdrop-filter)  B. 登录页(原样)  C. 真登录态面板页  D. 真登录态面板页(去 backdrop)
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9360
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROD_INFO'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function run(label, mode) {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fm-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 100) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    if (mode === 'login' || mode === 'login-noblur') {
      await nav(`${BASE}/#/login`)
      await sleep(1500)
      if (mode === 'login-noblur') { await ev(`var s=document.createElement('style');s.textContent='*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';document.head.appendChild(s);'ok'`); await sleep(300) }
    } else {
      // 同源 404 页种 token → 再以面板路由冷启动应用(真登录态)
      await nav(`${BASE}/favicon.ico`)
      await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
      await nav(`${BASE}/${PAGE}`)
      await sleep(3500)
      if (mode === 'panel-noblur') { await ev(`var s=document.createElement('style');s.textContent='*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';document.head.appendChild(s);'ok'`); await sleep(300) }
    }
    const hash = await ev('location.hash'); const bl = await ev('document.body.innerHTML.length')
    const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
    console.log(`[${label}] hash=${hash} body=${bl} ${out}`)
    try { execSync('powershell -NoProfile -Command "Add-Type -Namespace Z -Name X -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h,int c);\'; $p=Get-Process msedge | Where {$_.MainWindowHandle -ne 0} | Select -First 1; [Z.X]::ShowWindow($p.MainWindowHandle,9)"', { timeout: 15000 }) } catch {}
  } finally {
    try { edge.kill() } catch {}
    await sleep(1000); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
async function main() {
  await run('A 登录页去backdrop', 'login-noblur')
  await run('B 登录页原样', 'login')
  await run('C 真登录态面板页', 'panel')
  await run('D 真登录态面板页去backdrop', 'panel-noblur')
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
