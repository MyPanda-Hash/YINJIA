/* 真跑「下拉框里直接填新分区 → 保存 → 落库」—— CDP 真点(2026-10-08)
   全程跑在**测试账套 YJ_TEST(HSDZ_MES_TEST)**,不碰正式库。
   用法: node --experimental-websocket _probe-zone-save.cjs [panelCode] [frontUrl]
   输出里会打印 仓位编码 + 原值,便于事后还原。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PANEL = process.argv[2] || 'WHLOC'
const FRONT = process.argv[3] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9391
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const NEWZONE = 'ZZ临时测试区'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lg = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })).json()
  const user = lg.data.user
  console.log('[登录] factory=', user.factory, ' 令牌=测试账套')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-save-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=1920,1080',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description||'').slice(0,120) }; return r.result?.result?.value }
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i=0;i<50;i++){ await sleep(300); if ((await ev('document.readyState'))==='complete'){ await sleep(800); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/${PANEL}`)
    await sleep(4500)
    console.log('[title]', await ev('document.title'), '| 账套显示:', await ev(`(JSON.parse(localStorage.getItem('mes_factory')||'{}')).name`))

    const hdrs = await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>th.textContent.replace(/\\s+/g,'').trim())`)
    const zIdx = hdrs.findIndex((h) => h.includes('存储分区'))
    const cIdx = hdrs.findIndex((h) => h.includes('仓位编码'))
    console.log('[列] 仓位编码=', cIdx, ' 存储分区=', zIdx)

    // 优先找"已有存储分区"的行;本页没有就退回第 1 行(反正事后按 仓位编码 还原)
    const found = await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      let pick=null;
      for (let i=0;i<rows.length;i++){
        const z=rows[i].children[${zIdx}].textContent.trim();
        if(z){ pick={ i, 仓位编码: rows[i].children[${cIdx}].textContent.trim(), 原存储分区: z }; break; }
      }
      if(!pick && rows.length){
        pick={ i:0, 仓位编码: rows[0].children[${cIdx}].textContent.trim(),
               原存储分区: rows[0].children[${zIdx}].textContent.trim() || '(空)' };
      }
      return pick || { err: '没有任何数据行' };
    })()`)
    console.log('[目标行]', JSON.stringify(found))
    if (found.err) throw new Error(found.err)

    // 激活该单元格 → 下拉
    console.log('[激活]', JSON.stringify(await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${found.i}].children[${zIdx}];
      (cell.querySelector('.cell-lazy')||cell).click(); return 'clicked';
    })()`)))
    await sleep(800)
    // 展开下拉
    await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${found.i}].children[${zIdx}];
      const sw=cell.querySelector('.el-select__wrapper')||cell.querySelector('.el-select');
      sw.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); sw.click(); return 'ok';
    })()`)
    await sleep(800)
    // 输入一个列表里没有的新分区(allow-create)
    console.log('[输入新值]', JSON.stringify(await ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${found.i}].children[${zIdx}];
      const inp=cell.querySelector('.el-select input'); if(!inp) return 'no-input';
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp, ${JSON.stringify(NEWZONE)});
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      return 'typed';
    })()`)))
    await sleep(1000)
    const opts = await ev(`[...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.textContent.trim()).filter(Boolean)`)
    console.log('[下拉项]', JSON.stringify(opts))
    // 走**用户报障的那条路径**:输入后不点下拉项,直接用真实鼠标点别的行(失焦提交)
    const realClickAt = async (selExpr) => {
      const box = await ev(`(() => { const el=${selExpr}; if(!el) return null;
        const r=el.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }; })()`)
      if (!box || box.x == null) return 'no-box'
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      return `clicked@${box.x},${box.y}`
    }
    const other = found.i === 0 ? 2 : 0
    console.log('[真实鼠标点别的行(不点下拉项)]', await realClickAt(
      `document.querySelectorAll('.el-table__body .el-table__row')[${other}].children[${cIdx}].querySelector('.cell-lazy')`))
    await sleep(1200)
    console.log('[单元格现值]', JSON.stringify(await ev(`document.querySelectorAll('.el-table__body .el-table__row')[${found.i}].children[${zIdx}].textContent.trim()`)))

    // 保存
    console.log('\n[点保存]', JSON.stringify(await ev(`(() => {
      const b=[...document.querySelectorAll('.tb-main')].find(e=>e.textContent.replace(/\\s+/g,'').trim()==='保存');
      if(!b) return 'not-found';
      b.click(); return 'clicked';
    })()`)))
    await sleep(4000)
    console.log('[提示]', JSON.stringify(await ev(`[...document.querySelectorAll('.el-message__content')].map(e=>e.textContent.trim())`)))
    console.log('[保存后单元格]', JSON.stringify(await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const r=rows.find(r=>r.children[${cIdx}].textContent.trim()===${JSON.stringify(found.仓位编码)});
      return r? r.children[${zIdx}].textContent.trim() : '(本页找不到该行)';
    })()`)))
    console.log(`\n[还原用] 仓位编码=${found.仓位编码} 原存储分区=${found.原存储分区} 新值=${NEWZONE}`)
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
