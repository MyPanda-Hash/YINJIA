// _pdf-wide-check.cjs — 宽表导出完整性模拟:与组件同构(离屏克隆+按纸宽强制布局)截 PNG
// 用法: node _pdf-wide-check.cjs [BASE] [PANEL] [OUT.png]   默认 5173 RD_DROP_PREC
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9374
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = process.argv[3] || 'RD_DROP_PREC'
const OUTPNG = process.argv[4] || 'C:/INCER/YINJIA-MES/tools/_pdf-wide.png'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-wc-'))
  // 窄视口模拟:窗口 1000px,纸张 ~1300px → 最严苛的截断场景
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1000,900',
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + String(((r.result.exceptionDetails).exception || {}).description || '').slice(0, 200) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    // 强制窄视口(设备仿真):真实复现 max-width:100% 压缩场景
    await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/${PANEL}`)
    await sleep(3200)
    const r = await ev(`(async function(){
      try{
        var m=await import('/node_modules/.vite/deps/modern-screenshot.js');
        var el=document.querySelector('.approval-layout .record-sheet')||document.querySelector('.approval-layout .approval-sheet')||document.querySelector('.approval-layout .progress-sheet');
        var vw=el.offsetWidth, sw=el.scrollWidth;
        var w0=Math.max(sw,vw);
        var holder=document.createElement('div');
        holder.style.cssText='position:fixed;left:-10000px;top:0;width:'+w0+'px;background:#ffffff;';
        var clone=el.cloneNode(true);
        clone.style.width=w0+'px';clone.style.maxWidth='none';clone.style.overflow='visible';
        holder.appendChild(clone);document.body.appendChild(holder);
        await new Promise(function(rs){requestAnimationFrame(function(){requestAnimationFrame(rs)})});
        var h0=Math.max(clone.scrollHeight,clone.offsetHeight,el.scrollHeight);
        var url=await m.domToPng(clone,{scale:2,backgroundColor:'#ffffff',width:w0,height:h0,
          filter:function(n){return !(n instanceof HTMLElement && n.classList && n.classList.contains('no-print'))}});
        holder.remove();
        return JSON.stringify({vw:vw,sw:sw,w0:w0,h0:h0,urlLen:url.length,url:url})
      }catch(e){return JSON.stringify({err:String(e&&e.message||e)})}})()`)
    const o = JSON.parse(r || '{}')
    if (o.err) { console.log('ERR:', o.err); process.exit(1) }
    console.log(`视口内宽 ${o.vw}px → 纸宽 ${o.w0}px(溢出 ${o.w0 - o.vw}px), 纸高 ${o.h0}px, PNG ${(o.urlLen / 1024 / 1024).toFixed(2)}MB`)
    fs.writeFileSync(OUTPNG, Buffer.from(o.url.split(',')[1], 'base64'))
    console.log('saved →', OUTPNG)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
