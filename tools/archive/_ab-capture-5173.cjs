// _ab-capture-5173.cjs — 在 5173(dev)页内直接 A/B 两个截图库,定位哪个能在 dev 下工作
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9377
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ab-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + String(((r.result.exceptionDetails).exception || {}).description || '').slice(0, 300) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(2800)
    // A: html2canvas 直接截(vite deps URL)
    const a = await ev(`(async function(){
      try{var h=await import('/node_modules/.vite/deps/html2canvas.js');var el=document.querySelector('.approval-sheet')||document.querySelector('.record-sheet');
      var c=await h.default(el,{scale:1,backgroundColor:'#ffffff'});
      return 'OK '+c.width+'x'+c.height}catch(e){return 'ERR '+(e&&e.message||e)}})()`)
    console.log('A html2canvas(直接):', a)
    // B: html2canvas 离屏克隆
    const b = await ev(`(async function(){
      try{var h=await import('/node_modules/.vite/deps/html2canvas.js');var el=document.querySelector('.approval-sheet')||document.querySelector('.record-sheet');
      var holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:0;background:#fff;width:'+el.offsetWidth+'px';
      var clone=el.cloneNode(true);holder.appendChild(clone);document.body.appendChild(holder);
      var c=await h.default(clone,{scale:1,backgroundColor:'#ffffff'});holder.remove();
      return 'OK '+c.width+'x'+c.height}catch(e){return 'ERR '+(e&&e.message||e)}})()`)
    console.log('B html2canvas(离屏克隆):', b)
    // C: modern-screenshot domToPng 带显式宽高
    const c2 = await ev(`(async function(){
      try{var m=await import('/node_modules/.vite/deps/modern-screenshot.js');var el=document.querySelector('.approval-sheet')||document.querySelector('.record-sheet');
      var url=await m.domToPng(el,{scale:1,width:el.offsetWidth,height:el.offsetHeight,backgroundColor:'#ffffff'});
      return 'OK '+url.length}catch(e){return 'ERR '+(e&&e.message||e)}})()`)
    console.log('C modern-screenshot(domToPng):', c2)
    // D: modern-screenshot 不传宽高(自动 boundingBox)
    const d = await ev(`(async function(){
      try{var m=await import('/node_modules/.vite/deps/modern-screenshot.js');var el=document.querySelector('.approval-sheet')||document.querySelector('.record-sheet');
      var url=await m.domToPng(el,{scale:1,backgroundColor:'#ffffff'});
      return 'OK '+url.length}catch(e){return 'ERR '+(e&&e.message||e)}})()`)
    console.log('D modern-screenshot(自动尺寸):', d)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
