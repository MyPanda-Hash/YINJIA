/* 一次性探针:点开「测量值1」格后,dump 该格与全表输入框,定位编辑器的真实 DOM。 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9464
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-m5dbg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(6500)

  console.log('新增数据:', await ev(`(()=>{const b=[...document.querySelectorAll('button,.el-button,.tb-main')].find(x=>/新增数据/.test((x.innerText||'').trim()));if(!b)return 'NO';b.click();return 'OK'})()`))
  await sleep(1200)
  /* CDP 真实鼠标点击「测量值1」格(懒激活格子对合成 click 不响应,2026-10-16 实测) */
  const rect = await ev(`(()=>{
     const heads=[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=heads.indexOf('测量值1');
     const tr=document.querySelector('.el-table__body-wrapper tbody tr');
     const td=tr.querySelectorAll('td')[ci]; const r=td.getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),ci}) })()`)
  const pt = JSON.parse(String(rect))
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
  }
  console.log('真实点击坐标:', rect)
  await sleep(900)
  console.log('\n--- 该格 innerHTML ---')
  console.log(String(await ev(`(()=>{
     const heads=[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=heads.indexOf('测量值1');
     const tr=document.querySelector('.el-table__body-wrapper tbody tr');
     return tr.querySelectorAll('td')[ci].innerHTML.replace(/\\s+/g,' ').slice(0,600) })()`)))
  console.log('\n--- 表格体内 input/textarea 计数 ---', await ev(`document.querySelectorAll('.el-table__body-wrapper input, .el-table__body-wrapper textarea').length`))
  console.log('--- 整页可见 input(排除表头查询区) ---')
  console.log(String(await ev(`[...document.querySelectorAll('input,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.closest('.el-table')}).map(e=>e.tagName+'['+e.type+'] cls='+e.className+' val='+(e.value||'')+' inTd='+!!e.closest('td')).join('\\n')`)))
  console.log('\n--- 该行所有 td 文本 ---')
  console.log(String(await ev(`(()=>{const tr=document.querySelector('.el-table__body-wrapper tbody tr');return [...tr.querySelectorAll('td')].map((td,i)=>i+':'+(td.innerText||'').trim().slice(0,12)).join(' | ')})()`)))
} finally { try { edge.kill() } catch {} }
