// _pdf-fullness-check.cjs — 导出PDF完整性:同一代码路径截 PNG 存盘,量宽高 vs 纸张 scrollWidth/Height
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9375
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = process.argv[3] || 'RD_PROD_INFO'
const OUTPNG = process.argv[4] || 'C:/INCER/YINJIA-MES/tools/_pdf-fullness.png'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
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
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PANEL}`)
    await sleep(3000)
    const r = await ev(`(async function(){
      try{
        var m=await import('/node_modules/.vite/deps/modern-screenshot.js');
        var el=document.querySelector('.approval-layout .record-sheet')||document.querySelector('.approval-layout .approval-sheet')||document.querySelector('.approval-layout .progress-sheet');
        var w0=Math.max(el.scrollWidth,el.offsetWidth),h0=Math.max(el.scrollHeight,el.offsetHeight);
        var url=await m.domToPng(el,{scale:2,backgroundColor:'#ffffff',width:w0,height:h0,
          filter:function(n){return !(n instanceof HTMLElement && n.classList && n.classList.contains('no-print'))}});
        return JSON.stringify({w0:w0,h0:h0,urlLen:url.length,url:url})
      }catch(e){return JSON.stringify({err:String(e&&e.message||e)})}})()`)
    const o = JSON.parse(r || '{}')
    if (o.err) { console.log('ERR:', o.err); process.exit(1) }
    console.log(`纸张尺寸 ${o.w0}x${o.h0}, PNG ${(o.urlLen / 1024 / 1024).toFixed(2)}MB`)
    fs.writeFileSync(OUTPNG, Buffer.from(o.url.split(',')[1], 'base64'))
    console.log('saved →', OUTPNG)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
