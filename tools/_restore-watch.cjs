// _restore-watch.cjs — 最小化后窗口自动恢复监控(页面侧事件日志 + 轮询可见性)
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9372
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROGRESS'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rw-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav(`${BASE}/${PAGE}`)
    await sleep(3000)
    await ev(`(function(){window.__ev=[];
      ['visibilitychange','focus','blur','pagehide','pageshow','resize'].forEach(function(t){
        window.addEventListener(t,function(){window.__ev.push(t+':'+Date.now())},true)});
      document.addEventListener('visibilitychange',function(){window.__ev.push('doc-vis:'+document.visibilityState+':'+Date.now())},true);
      return 1})()`)
    console.log('页面就绪。1.5 秒后由 PowerShell 最小化窗口…')
    setTimeout(() => {
      try { execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_restore-watch-min.ps1 -DelayMs 500', { cwd: 'C:/INCER/YINJIA-MES' }) } catch (e) { console.log('minimize fail: ' + e.message) }
    }, 1500)
    const { execSync } = require('node:child_process')
    setTimeout(() => {
      try { execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_restore-watch-min.ps1 -DelayMs 1000', { cwd: 'C:/INCER/YINJIA-MES' }) } catch (e) { console.log('minimize fail', e.message) }
    }, 1500)
    for (let i = 0; i < 16; i++) {
      await sleep(500)
      const vis = await ev('document.visibilityState')
      if (i % 2 === 1) console.log(`${(i + 1) * 500}ms doc.vis=${vis} 事件数=${await ev('(window.__ev||[]).length')}`)
    }
    console.log('页面事件时间线:', await ev('JSON.stringify(window.__ev || [])'))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
