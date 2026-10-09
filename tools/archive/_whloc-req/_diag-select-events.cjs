/* 诊断:el-select 输入框上 native blur/focusout/change/input 到底发生了什么
   用法: node --experimental-websocket _diag-select-events.cjs [frontUrl] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const FRONT = process.argv[2] || 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'; const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lg = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })).json()
  const user = lg.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-diag-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=1920,1080',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text }; return r.result?.result?.value }
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i=0;i<50;i++){ await sleep(300); if ((await ev('document.readyState'))==='complete'){ await sleep(800); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/WHLOC`)
    await sleep(4500)
    const hdrs = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>th.textContent.replace(/\\s+/g,'').trim())`)
    const zIdx = hdrs.findIndex((h) => h.includes('存储分区'))
    const cIdx = hdrs.findIndex((h) => h.includes('仓位编码'))
    console.log(`[列] 仓位编码=${cIdx} 存储分区=${zIdx}`)

    // 挂 native 监听(记录到 window.__evts)
    console.log('[挂监听]', await ev(`(() => {
      window.__evts=[];
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}];
      (cell.querySelector('.cell-lazy')||cell).click();
      return 'activated';
    })()`))
    await sleep(800)
    console.log('[监听已挂]', await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}];
      const inp=cell.querySelector('.el-select input'); if(!inp) return 'no-input';
      window.__inp=inp;
      for (const t of ['blur','focusout','change','input','keydown']) {
        inp.addEventListener(t, (e)=>{ window.__evts.push(t + ' | value=' + JSON.stringify(inp.value) + ' | related=' + (e.relatedTarget? (e.relatedTarget.tagName||'') : 'null')) }, true);
      }
      // 顺带监听整个 select 根,看 focusout 是否冒泡到
      const root=cell.querySelector('.el-select');
      root.addEventListener('focusout', (e)=>{ window.__evts.push('select-root focusout | value=' + JSON.stringify(inp.value)) }, true);
      return 'listeners attached on ' + inp.tagName + '.' + inp.className;
    })()`))

    console.log('[输入]', await ev(`(() => {
      const inp=window.__inp; inp.focus();
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp,'ZZ诊断区'); inp.dispatchEvent(new Event('input',{bubbles:true}));
      return 'typed; active=' + (document.activeElement===inp);
    })()`))
    await sleep(1000)
    console.log('[点别处前]', JSON.stringify(await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}];
      return { 事件: window.__evts.slice(), 输入框值: window.__inp.value, 单元格文本: cell.textContent.trim() };
    })()`)))

    console.log('[模拟点别的行:先 blur 再点]', await ev(`(() => {
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const r=document.querySelectorAll('.el-table__body .el-table__row')[2];
      const c=r.children[${cIdx}]; (c.querySelector('.cell-lazy')||c).click(); return 'done';
    })()`))
    await sleep(1200)
    console.log('[点后]', JSON.stringify(await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}];
      return { 事件: window.__evts.slice(), 单元格文本: cell.textContent.trim() };
    })()`)))
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
