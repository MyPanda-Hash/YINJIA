// _restore-bisect.cjs — 二分定位:逐个移除布局组件后最小化,看是否仍被自动恢复
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9366
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROD_INFO'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bs-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav(`${BASE}/${PAGE}`)
    await sleep(3500)
    // 基线:确认当前页(未拆)会恢复
    const runOne = async (name, stripExpr) => {
      if (stripExpr) { await ev(stripExpr); await sleep(300) }
      const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
      console.log(`[${name}] ${out}`)
      // 恢复窗口继续下一项
      await ev('(function(){var w=window;return 1})()')
      await sleep(400)
    }
    // 注意:最小化后窗口恢复时才继续;若 final iconic 则手动 restore
    const restoreWin = () => { try { execSync('powershell -NoProfile -Command "Add-Type -Namespace Z -Name X -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h,int c);\'; $p=Get-Process msedge | Where {$_.MainWindowHandle -ne 0} | Select -First 1; [Z.X]::ShowWindow($p.MainWindowHandle,9)"', { timeout: 15000 }) } catch {} }
    await runOne('基线(不拆)')
    restoreWin(); await sleep(600)
    await runOne('拆掉顶栏 .topbar', 'document.querySelectorAll(".topbar").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉页签 .tabsbar', 'document.querySelectorAll(".tabsbar").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉左栏 .left-nav', 'document.querySelectorAll(".left-nav,.side-nav,.nav-wrap").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉通知中心 .notice-center', 'document.querySelectorAll(".notice-center").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉全部 canvas(echarts)', 'document.querySelectorAll("canvas").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉全部 popper', 'document.querySelectorAll(".el-popper").forEach(function(e){e.remove()})')
    restoreWin(); await sleep(600)
    await runOne('拆掉全部 dialog/遮罩', 'document.querySelectorAll(".el-overlay,.el-dialog__wrapper").forEach(function(e){e.remove()})')
    restoreWin()
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
