// _restore-stack.cjs — 最小化自动恢复瞬间:记录页面里 focus/open/alert/print 等可致窗口恢复的调用及堆栈
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9368
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_PROD_INFO'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rs-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 150) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav(`${BASE}/${PAGE}`)
    await sleep(3500)
    // 全量插桩:任何能导致窗口恢复/抢焦点的调用都记堆栈
    await ev(`(function(){
      window.__calls = []
      function tag(name){ return name + '@' + Date.now() + '\\n' + (new Error().stack || '').split('\\n').slice(2, 6).join('\\n') }
      var of = window.focus
      window.focus = function(){ window.__calls.push(tag('window.focus')); try { return of.apply(this, arguments) } catch(e){} }
      var ofe = HTMLElement.prototype.focus
      HTMLElement.prototype.focus = function(){ window.__calls.push(tag('el.focus<' + (this.className || this.tagName) + '>')); return ofe.apply(this, arguments) }
      var oo = window.open
      window.open = function(){ window.__calls.push(tag('window.open ' + arguments[0])); return oo ? oo.apply(window, arguments) : null }
      var oa = window.alert, oc = window.confirm, op = window.print
      window.alert = function(m){ window.__calls.push(tag('alert:' + m)); }
      window.confirm = function(m){ window.__calls.push(tag('confirm:' + m)); return false }
      window.print = function(){ window.__calls.push(tag('window.print')); }
      var osi = window.scrollTo
      window.scrollTo = function(){ window.__calls.push(tag('scrollTo')); return osi ? osi.apply(window, arguments) : undefined }
      return 1})()`)
    console.log('插桩完成,最小化…')
    try { execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_restore-watch-min.ps1 -DelayMs 500', { cwd: 'C:/INCER/YINJIA-MES' }) } catch (e) { console.log('min fail') }
    for (let i = 0; i < 12; i++) {
      await sleep(600)
      const vis = await ev('document.visibilityState')
      process.stdout.write(`${(i + 1) * 600}ms:${vis} `)
    }
    console.log('')
    console.log('恢复相关调用栈:', await ev('JSON.stringify(window.__calls || [], null, 1)'))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
