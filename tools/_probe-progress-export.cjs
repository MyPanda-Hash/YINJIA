// _probe-progress-export.cjs — 项目进度查询导出失败定位:Excel/PDF 两路各自跑,抓 console 错误与下载
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9378
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-px-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params && ['error', 'log', 'warning'].includes(m.params.type))
        errs.push(m.params.type + ': ' + (m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 300))
      if (m.method === 'Runtime.exceptionThrown')
        errs.push('EXC: ' + String((m.params.exceptionDetails || {}).text || '') + ' ' + String(((m.params.exceptionDetails || {}).exception || {}).description || '').slice(0, 300))
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 200) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROGRESS`)
    await sleep(2800)
    // 拦截下载(createObjectURL 截 Blob)
    await ev(`(function(){window.__blob=null;var o=URL.createObjectURL;URL.createObjectURL=function(b){try{if(b&&b.size>500)window.__blob=b}catch(e){}return o.apply(this,arguments)};return 1})()`)
    // Excel 导出
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='导出'){b[i].click();return 1}}return 0})()`)
    await sleep(800)
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var its=[].slice.call(d.querySelectorAll('.efmt-item'));
      for(var i=0;i<its.length;i++){if((its[i].textContent||'').indexOf('Excel')>=0){its[i].click();return 1}}return 0})()`)
    await sleep(2500)
    const msgs1 = await ev(`[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join('||')`)
    const blob1 = await ev('window.__blob ? window.__blob.size : null')
    console.log('Excel 导出: msgs=', msgs1, ' blob=', blob1)
    // PDF 导出
    await ev('window.__blob=null')
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='导出'){b[i].click();return 1}}return 0})()`)
    await sleep(800)
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var its=[].slice.call(d.querySelectorAll('.efmt-item'));
      for(var i=0;i<its.length;i++){if((its[i].textContent||'').indexOf('PDF')>=0){its[i].click();return 1}}return 0})()`)
    await sleep(3000)
    let blob2 = null
    for (let w = 0; w < 10; w++) { blob2 = await ev('window.__blob ? window.__blob.size : null'); if (blob2) break; await sleep(1000) }
    const msgs2 = await ev(`[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()}).join('||')`)
    console.log('PDF 导出: msgs=', msgs2, ' blob=', blob2)
    console.log('console 输出(尾部):', JSON.stringify(errs.slice(-6), null, 1))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
