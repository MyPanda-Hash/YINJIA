/* 验证「大区/存储分区」行内编辑器已变成可选可填的下拉(提示型) —— CDP 真点(2026-10-08)
   用法: node --experimental-websocket _probe-zone-select.cjs [panelCode] [frontUrl]
   ⚠ 全程不点保存,草稿随浏览器关闭丢弃。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PANEL = process.argv[2] || 'WHLOC'
const FRONT = process.argv[3] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-zsel-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=1920,1080',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text }
      return r.result?.result?.value
    }
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i=0;i<50;i++){ await sleep(300); if ((await ev('document.readyState'))==='complete'){ await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/${PANEL}`)
    await sleep(4500)
    console.log('[title]', await ev('document.title'))

    const hdrs = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>th.textContent.replace(/\\s+/g,'').trim())`)
    for (const want of ['大区', '存储分区']) {
      const idx = hdrs.findIndex((h) => h.includes(want))
      console.log(`\n########## ${want} (列下标 ${idx}) ##########`)
      if (idx < 0) { console.log('  ★ 表头找不到该列'); continue }
      // 激活单元格
      console.log('  激活:', JSON.stringify(await ev(`(() => {
        const r=document.querySelectorAll('.el-table__body .el-table__row')[0];
        const cell=r.children[${idx}]; const tgt=cell.querySelector('.cell-lazy')||cell;
        const before=cell.querySelector('.el-select')?'el-select':'无编辑器';
        tgt.click(); return { textBefore: cell.textContent.trim(), editorBefore: before };
      })()`)))
      await sleep(700)
      const ed = await ev(`(() => {
        const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${idx}];
        const sel=cell.querySelector('.el-select'); const inp=cell.querySelector('.el-input');
        const inner=sel? sel.querySelector('input') : null;
        return { hasSelect: !!sel, hasInput: !!inp,
                 filterable: sel ? sel.className.includes('filterable') : null,
                 inputEditable: inner ? (!inner.readOnly && !inner.disabled) : null,
                 placeholder: inner ? inner.placeholder : null,
                 cellHTML: cell.innerHTML.slice(0,180) };
      })()`)
      console.log('  编辑器:', JSON.stringify(ed))
      if (!ed || !ed.hasSelect) { console.log('  ★ 不是下拉框 —— 编辑器没变成 el-select'); continue }
      // 展开下拉读候选
      await ev(`(() => {
        const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${idx}];
        const inp=cell.querySelector('.el-select input'); if(inp){inp.focus();}
        const sw=cell.querySelector('.el-select__wrapper')||cell.querySelector('.el-select');
        sw.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); sw.click(); return 'ok';
      })()`)
      await sleep(900)
      const opts = await ev(`[...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.textContent.trim()).filter(Boolean)`)
      console.log('  候选(提示列表):', JSON.stringify(opts))
      // 输入一个列表里没有的新分区,验证"可选可填"(allow-create)
      const typed = await ev(`(() => {
        const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${idx}];
        const inp=cell.querySelector('.el-select input'); if(!inp) return 'no-input';
        const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
        setter.call(inp,'__测试新分区__');
        inp.dispatchEvent(new Event('input',{bubbles:true}));
        return 'typed';
      })()`)
      await sleep(900)
      const created = await ev(`[...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.textContent.trim()).filter(Boolean)`)
      console.log('  输入新值后候选:', JSON.stringify(created), typed === 'typed' && created.includes('__测试新分区__') ? '✓ allow-create 生效(可自填)' : '(注:allow-create 的新项通常在选中后才进列表)')
      // 关掉下拉,别影响下一轮
      await ev(`document.body.click(); 'ok'`)
      await sleep(400)
    }
    console.log('\n⚠ 全程未点「保存」,库内数据未变。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
