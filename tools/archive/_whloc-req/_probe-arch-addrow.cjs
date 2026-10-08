/* 探「档案面板怎么新增一行仓位」—— CDP 真看(2026-10-08)
   用法: node --experimental-websocket _probe-arch-addrow.cjs [panelCode] [frontUrl]
   ⚠ 只点占位行看是否变成新行,绝不点保存。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PANEL = process.argv[2] || 'WHLOC'
const FRONT = process.argv[3] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-add-'))
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

    console.log('[分页信息]', JSON.stringify(await ev(`(() => {
      const t=document.body.innerText;
      const pager=[...document.querySelectorAll('.el-pagination__total,.el-pager li,.el-input__inner')].map(e=>e.textContent||e.value).filter(Boolean).slice(0,12);
      return { 行数: document.querySelectorAll('.el-table__body .el-table__row').length,
               末行内容: (document.querySelectorAll('.el-table__body .el-table__row').length? [...document.querySelectorAll('.el-table__body .el-table__row')].pop().textContent.replace(/\\s+/g,' ').trim().slice(0,60):'(无)'),
               分页: pager };
    })()`)))

    // 找末页(占位行通常在整份档案末尾)
    console.log('[跳末页]', JSON.stringify(await ev(`(() => {
      const li=[...document.querySelectorAll('.el-pager li')];
      const last=li[li.length-1]; if(!last) return 'no-pager';
      last.click(); return 'clicked page ' + last.textContent.trim();
    })()`)))
    await sleep(2000)
    console.log('[末页行]', JSON.stringify(await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      return { 行数: rows.length,
               末行文本: rows.length? rows[rows.length-1].textContent.replace(/\\s+/g,' ').trim().slice(0,80):'(无)',
               末行是否空: rows.length? rows[rows.length-1].textContent.replace(/\\s+/g,'').trim()==='' : null };
    })()`)))

    // 点末行第 0 格(占位行 → 新增行)
    const before = await ev(`document.querySelectorAll('.el-table__body .el-table__row').length`)
    console.log('[点末行]', JSON.stringify(await ev(`(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const r=rows[rows.length-1]; if(!r) return 'no-row';
      const tgt=r.querySelector('.cell-lazy')||r.querySelector('.cell')||r;
      tgt.click(); return 'clicked';
    })()`)))
    await sleep(1500)
    const after = await ev(`document.querySelectorAll('.el-table__body .el-table__row').length`)
    console.log(`[结果] 点前行数=${before} 点后行数=${after} ${after>before?'✓ 占位行变新行(新增入口在这)':'(行数未变)'}`)
    console.log('[工具栏提示]', JSON.stringify(await ev(`[...document.querySelectorAll('.el-message,.el-message__content')].map(e=>e.textContent.trim()).filter(Boolean)`)))
    console.log('\n⚠ 未点保存,新增行随浏览器关闭丢弃。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
