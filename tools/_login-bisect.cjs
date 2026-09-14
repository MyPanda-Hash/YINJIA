// _login-bisect.cjs — 登录页内部二分:背景大图 / 语言select / 表单,谁导致最小化自动恢复
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9359
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function run(label, stripExpr) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lb-'))
  const edge = spawn(EDGE, ['--no-first-run', '--window-size=1400,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
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
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    const removed = await ev(stripExpr)
    await sleep(300)
    const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
    console.log(`[${label}](移除=${removed}) ${out}`)
    try { execSync('powershell -NoProfile -Command "Add-Type -Namespace Z -Name X -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr h,int c);\'; $p=Get-Process msedge | Where {$_.MainWindowHandle -ne 0} | Select -First 1; [Z.X]::ShowWindow($p.MainWindowHandle,9)"', { timeout: 15000 }) } catch {}
  } finally {
    try { edge.kill() } catch {}
    await sleep(1000); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
async function main() {
  await run('基线(原样登录页)', "'-'")
  await run('仅隐藏背景大图', "var i=document.querySelector('.login-scene img');i?(i.style.display='none','img'):'nf'")
  await run('仅移除背景大图节点', "var i=document.querySelector('.login-scene img');i?(i.remove(),'img-node'):'nf'")
  await run('仅移除语言el-select', "var l=document.querySelector('.login-locale');l?(l.remove(),'locale'):'nf'")
  await run('仅移除表单区', "var f=document.querySelector('.login-form');f?(f.remove(),'form'):'nf'")
  await run('移除整个场景层', "var s=document.querySelector('.login-scene');s?(s.remove(),'scene'):'nf'")
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
