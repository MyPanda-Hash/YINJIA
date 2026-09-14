// _spec-cover-shot.cjs — 规格书封面编辑态截图(供视觉核验半截字)
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9353
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-scs-'))
  const edge = spawn(EDGE, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--window-size=1100,1500',
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
      return r.result && r.result.result ? r.result.result.value : undefined }
    const shot = async () => { const r = await send('Page.captureScreenshot', { format: 'png' }); return Buffer.from(r.result.data, 'base64') }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done', '1'); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
    await sleep(3500)
    await ev(`window.scrollTo(0,0); document.querySelector('.rsp-cover-page').scrollIntoView(); 'ok'`)
    // 关掉可能弹出的初始化向导/遮罩
    await ev(`(function(){
      document.querySelectorAll('.el-dialog__headerbtn').forEach(function(b){try{b.click()}catch(e){}})
      document.querySelectorAll('.el-overlay').forEach(function(e){e.remove()})
      document.documentElement.style.overflow='auto'
      return 'cleaned'})()`)
    await sleep(800)
    const png = await shot()
    const out = 'C:/INCER/YINJIA-MES/tools/_spec-cover-edit.png'
    fs.writeFileSync(out, png)
    console.log('saved →', out, (png.length / 1024).toFixed(0) + 'KB')
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
