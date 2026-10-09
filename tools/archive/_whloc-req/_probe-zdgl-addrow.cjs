/* 验证「数据字典(ZDGL)面板能不能在界面新增一行」—— CDP 真看(2026-10-08)
   背景:档案面板的"新增一行"入口 = 列表末尾占位行,而 pagedBlockRows 只在
        real.length <= archPageSize 时才带占位行 ⇒ 大数据量档案要先筛到一页内。
   用法: node --experimental-websocket _probe-zdgl-addrow.cjs [frontUrl]
   ⚠ 只看不写:不点保存。 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const FRONT = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'; const PORT = 9371
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-zdgl-'))
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

    const snapshot = `(() => {
      const rows=[...document.querySelectorAll('.el-table__body .el-table__row')];
      const blank=rows.filter(r=>r.textContent.replace(/\\s+/g,'').trim()==='').length;
      return { 显示行数: rows.length, 空行数: blank,
               末行: rows.length? rows[rows.length-1].textContent.replace(/\\s+/g,' ').trim().slice(0,50):'(无)',
               分页: [...document.querySelectorAll('.el-pagination__total')].map(e=>e.textContent.trim()) };
    })()`

    console.log('\n########## ① 默认视图 ##########')
    console.log(JSON.stringify(await ev(snapshot)))

    // 在查询区把「字典类别」填成 WH_ZONE 并查询
    console.log('\n########## ② 筛 字典类别=WH_ZONE ##########')
    const typed = await ev(`(() => {
      const labels=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && e.textContent.trim()==='字典类别');
      if(!labels.length) return 'label-not-found';
      // 往上找到包含输入框的容器
      let box=labels[0]; for(let i=0;i<6 && box;i++){ box=box.parentElement; if(box && box.querySelector('input')) break; }
      const inp=box? box.querySelector('input') : null; if(!inp) return 'input-not-found';
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp,'WH_ZONE'); inp.dispatchEvent(new Event('input',{bubbles:true}));
      // 找「查询」按钮
      const qb=[...document.querySelectorAll('button,.tb-main')].find(b=>b.textContent.replace(/\\s+/g,'').trim()==='查询');
      if(qb) qb.click();
      return qb? 'typed+queried' : 'typed(未找到查询按钮)';
    })()`)
    console.log('  操作:', typed)
    await sleep(2500)
    console.log('  ', JSON.stringify(await ev(snapshot)))
    console.log('\n⚠ 未点保存。')
  } finally { try { edge.kill() } catch {} }
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1) })
