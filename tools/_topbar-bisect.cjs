// _topbar-bisect.cjs — 顶栏内部逐子元素拆除,定位自动恢复元凶
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9365
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROD_INFO'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tb-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 120) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav(`${BASE}/${PAGE}`)
    await sleep(3500)
    const restoreWin = () => { try { execSync('powershell -NoProfile -Command "Add-Type -Namespace Z -Name X -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h,int c);\'; $p=Get-Process msedge | Where {$_.MainWindowHandle -ne 0} | Select -First 1; [Z.X]::ShowWindow($p.MainWindowHandle,9)"', { timeout: 15000 }) } catch {} }
    const runOne = async (name, stripExpr) => {
      await ev(stripExpr); await sleep(250)
      const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
      console.log(`[${name}] ${out}`)
      restoreWin(); await sleep(500)
    }
    // 顶栏子元素(从左到右):工厂下拉/企业名/模块菜单/搜索/语言/公告/移动端/通知中心/全屏/帮助/用户
    await runOne('顶栏全部子元素保留(基线)', '1')
    await runOne('拆工厂下拉+企业名', 'var t=document.querySelector(".topbar");var c=t&&t.children[0];c&&c.remove()')
    await runOne('拆语言切换下拉', 'document.querySelectorAll(".topbar [class*=locale],.topbar .el-dropdown").forEach(function(e,i){if((e.textContent||"").indexOf("中")>=0||i===0)e.remove()});var s=document.querySelectorAll(".topbar .bar-icon");0')
    await runOne('拆移动端icon(tooltip)', 'document.querySelectorAll(".topbar .bar-icon").forEach(function(e){if((e.textContent||"").indexOf("\\uD83D\\uDCF1")>=0||(e.getAttribute("aria-label")||"").indexOf("移动")>=0)e.remove()});document.querySelectorAll(".topbar .el-tooltip__trigger").forEach(function(e,i){if(i===0)e.remove()})')
    await runOne('拆全屏icon(tooltip)', 'var s=document.querySelectorAll(".topbar .el-tooltip__trigger");if(s.length)s[s.length-1].remove()')
    await runOne('拆帮助下拉', 'document.querySelectorAll(".topbar .el-dropdown").forEach(function(e){if((e.textContent||"").indexOf("?")>=0||e.querySelector(".el-icon")){if((e.textContent||"").length<20)e.remove()}})')
    await runOne('拆用户下拉', 'var u=document.querySelector(".topbar .user");u&&u.remove()')
    await runOne('拆通知中心', 'document.querySelectorAll(".notice-center").forEach(function(e){e.remove()})')
    // 更细:如果以上都还翻,最后拆所有 tooltip trigger
    await runOne('拆全部 el-tooltip trigger', 'document.querySelectorAll(".topbar .el-tooltip__trigger,.topbar [aria-describedby]").forEach(function(e){e.remove()})')
    await runOne('拆顶栏右区 .t-right 整块', 'var r=document.querySelector(".topbar .t-right");r&&r.remove()')
    restoreWin()
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
