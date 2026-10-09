/* 复现「下拉可填写后,点其他行值就丢」—— CDP 真点(2026-10-08, 测试账套 YJ_TEST)
   两条路径都测:
     A 输入 → 点下拉里的新项(提交) → 点别的行  → 值应保留
     B 输入 → 不点下拉项,直接点别的行(失焦)   → 值会丢(用户报的就是这条?)
   用法: node --experimental-websocket _probe-zone-blur.cjs [frontUrl]
   不点保存,不改库。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const FRONT = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9401
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lg = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })).json()
  const user = lg.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-blur-'))
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

    const activate = (i, val) => ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${i}].children[${zIdx}];
      (cell.querySelector('.cell-lazy')||cell).click(); return 'ok';
    })()`)
    const openDrop = (i) => ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${i}].children[${zIdx}];
      const sw=cell.querySelector('.el-select__wrapper')||cell.querySelector('.el-select');
      sw.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); sw.click(); return 'ok';
    })()`)
    const typeVal = (i, v) => ev(`(() => {
      const cell=document.querySelectorAll('.el-table__body .el-table__row')[${i}].children[${zIdx}];
      const inp=cell.querySelector('.el-select input'); if(!inp) return 'no-input';
      inp.focus();                                   // ⚠ 不 focus 就没有 blur 可触发
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp, ${JSON.stringify(v)}); inp.dispatchEvent(new Event('input',{bubbles:true}));
      return 'typed; active=' + (document.activeElement? document.activeElement.tagName+'.'+String(document.activeElement.className).slice(0,30) : 'none');
    })()`)
    const cellText = (i) => ev(`document.querySelectorAll('.el-table__body .el-table__row')[${i}].children[${zIdx}].textContent.trim()`)
    // ⚠ 程序化 .click()/.blur() 都不可靠:实测 native blur/focusout 根本不触发(EP 重渲染会换 input 节点)。
    //   用 CDP **真实鼠标事件**点别处 —— 这才是用户的真实操作,也才会真正移动焦点。
    const realClickAt = async (selExpr) => {
      const box = await ev(`(() => { const el=${selExpr}; if(!el) return null;
        const r=el.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }; })()`)
      if (!box || box.x == null) return 'no-box'
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      return `clicked@${box.x},${box.y}`
    }
    const clickRow = (i) => realClickAt(`document.querySelectorAll('.el-table__body .el-table__row')[${i}].children[${cIdx}].querySelector('.cell-lazy')`)

    for (const path of ['A', 'B']) {
      const val = path === 'A' ? 'ZZ路径A区' : 'ZZ路径B区'
      console.log(`\n########## 路径 ${path} : ${path === 'A' ? '输入→点下拉项→点别的行' : '输入→直接点别的行(失焦)'} ##########`)
      await activate(0)
      await sleep(700)
      await openDrop(0)
      await sleep(700)
      console.log('  输入:', await typeVal(0, val))
      await sleep(1000)
      if (path === 'A') {
        console.log('  点下拉项:', await ev(`(() => {
          const it=[...document.querySelectorAll('.el-select-dropdown__item')].find(e=>e.textContent.trim()===${JSON.stringify(val)});
          if(!it) return 'not-found'; it.click(); return 'clicked';
        })()`))
        await sleep(1000)
      }
      console.log('  点别处前单元格 =', JSON.stringify(await cellText(0)))
      console.log('  点第 3 行的仓位编码格:', await clickRow(2))
      await sleep(1200)
      const after = await cellText(0)
      console.log('  点别处后单元格 =', JSON.stringify(after))
      console.log(after === val ? '  >>> ✓ 保留' : `  >>> ★ 丢失(退回 "${after}")`)
      // 复位:重新激活并清空
      await activate(0); await sleep(500)
      await ev(`(() => { const cell=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${zIdx}]; const c=cell.querySelector('.el-select .el-select__clear, .el-select .el-icon'); return 'ok'; })()`)
      await sleep(300)
    }
    console.log('\n⚠ 未点保存。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
