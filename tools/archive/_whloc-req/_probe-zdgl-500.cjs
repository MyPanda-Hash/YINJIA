/* 验证「数据字典面板:每页改 500 → 末尾出现空行 → 点开变新行」—— 系统内加下拉数据的最后一环
   用法: node --experimental-websocket _probe-zdgl-500.cjs [frontUrl]
   ⚠ 只点空行看是否变新行,绝不点保存。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const FRONT = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9381
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-500-'))
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
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i=0;i<50;i++){ await sleep(300); if ((await ev('document.readyState'))==='complete'){ await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-10-08'); 'ok'`)
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/ZDGL`)
    await sleep(4500)
    console.log('[title]', await ev('document.title'))
    const snap = `(() => { const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      return { 行数: rows.length, 空行数: rows.filter(r=>r.textContent.replace(/\\s+/g,'').trim()==='').length,
               总数: [...document.querySelectorAll('.el-pagination__total')].map(e=>e.textContent.trim())[0],
               每页: (document.querySelector('.el-pagination .el-select input')||{}).value }; })()`
    console.log('[改前]', JSON.stringify(await ev(snap)))

    // 点分页器的每页下拉,选「500条/页」
    console.log('[开每页下拉]', JSON.stringify(await ev(`(() => {
      const sel=document.querySelector('.el-pagination .el-select'); if(!sel) return 'no-size-select';
      const sw=sel.querySelector('.el-select__wrapper')||sel;
      sw.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); sw.click(); return 'opened';
    })()`)))
    await sleep(900)
    const sizeOpts = await ev(`[...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.textContent.trim()).filter(Boolean)`)
    console.log('[每页候选]', JSON.stringify(sizeOpts))
    console.log('[选 500]', JSON.stringify(await ev(`(() => {
      const it=[...document.querySelectorAll('.el-select-dropdown__item')].find(e=>e.textContent.includes('500'));
      if(!it) return 'no-500-option'; it.click(); return 'clicked';
    })()`)))
    await sleep(2500)
    const after = await ev(snap)
    console.log('[改后]', JSON.stringify(after))

    if (after && after.空行数 > 0) {
      const before = after.行数
      console.log('[点空行]', JSON.stringify(await ev(`(() => {
        const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
        const blank=rows.find(r=>r.textContent.replace(/\\s+/g,'').trim()==='');
        if(!blank) return 'no-blank';
        const tgt=blank.querySelector('.cell-lazy')||blank.querySelector('.cell')||blank;
        tgt.click(); return 'clicked';
      })()`)))
      await sleep(1500)
      const res = await ev(snap)
      console.log('[点后]', JSON.stringify(res))
      console.log(res && res.行数 > before ? '  >>> ✓ 空行变新行 —— 系统内新增入口可用' : '  >>> 行数未变(占位行未变成新行)')
      console.log('[消息]', JSON.stringify(await ev(`[...document.querySelectorAll('.el-message__content')].map(e=>e.textContent.trim())`)))
    } else {
      console.log('  >>> ★ 每页 500 后仍未出现空行')
    }
    console.log('\n⚠ 未点保存。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
