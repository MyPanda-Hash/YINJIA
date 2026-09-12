// _save-sample-pdf.cjs — 触发一次导出PDF,把生成的 Blob 落成本地文件供人工查看
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9379
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const OUT = process.argv[3] || 'C:/INCER/YINJIA-MES/tools/_样例-产品信息表导出.pdf'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sp-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 120) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(2800)
    await ev(`(function(){var oco=URL.createObjectURL;URL.createObjectURL=function(b){try{if(b&&b.size>1000)window.__blob=b}catch(e){}return oco.apply(this,arguments)};return 1})()`)
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='导出'){b[i].click();return 1}}return 0})()`)
    await sleep(900)
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var its=[].slice.call(d.querySelectorAll('.efmt-item'));
      for(var i=0;i<its.length;i++){if((its[i].textContent||'').indexOf('PDF')>=0){its[i].click();return 1}}return 0})()`)
    for (let i = 0; i < 15; i++) { await sleep(1000); if (await ev('window.__blob')) break }
    const b64 = await ev(`(async function(){if(!window.__blob)return '';var buf=await window.__blob.arrayBuffer();
      var u=new Uint8Array(buf);var s='';for(var i=0;i<u.length;i+=32768){s+=String.fromCharCode.apply(null,u.subarray(i,i+32768))}
      return btoa(s)})()`)
    if (typeof b64 === 'string' && b64.length > 100) {
      fs.writeFileSync(OUT, Buffer.from(b64, 'base64'))
      console.log('saved →', OUT, (Buffer.from(b64, 'base64').length / 1024).toFixed(0) + 'KB')
    } else {
      console.log('no blob captured:', b64)
    }
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
