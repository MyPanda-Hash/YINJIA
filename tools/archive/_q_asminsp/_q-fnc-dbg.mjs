/* 一次性探针:真实键入后,该行各格与输入框的实际状态(定位"回显失败"是取值问题还是模型问题)。 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9467
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fncdbg-'))
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
  await ev(`(()=>{const b=[...document.querySelectorAll('button,.el-button,.tb-main')].find(x=>/新增数据/.test((x.innerText||'').trim()));b&&b.click();return 1})()`)
  await sleep(1000)
  const pt = JSON.parse(String(await ev(`(()=>{
     const heads=[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=heads.indexOf('产线常规功能性结果');
     const tr=document.querySelector('.el-table__body-wrapper tbody tr');
     const td=tr.querySelectorAll('td')[ci]; const r=td.getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}) })()`)))
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
  }
  await sleep(600)
  console.log('打开编辑器后 activeElement =', await ev(`document.activeElement ? document.activeElement.tagName+'/'+document.activeElement.className : 'null'`))
  await ev(`(()=>{const i=document.querySelector('.el-table__body-wrapper input[type=number]');const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();return 1})()`)
  await send('Input.insertText', { text: '12.5' })
  await sleep(400)
  console.log('插入后 input.value =', await ev(`(document.querySelector('.el-table__body-wrapper input[type=number]')||{}).value`))
  console.log('插入后 该格文本 =', await ev(`(()=>{const h=[...document.querySelectorAll('.el-table__header th')].map(t=>(t.innerText||'').replace(/[\\s⇅↑↓]+/g,''));const ci=h.indexOf('产线常规功能性结果');const tr=document.querySelector('.el-table__body-wrapper tbody tr');return (tr.querySelectorAll('td')[ci].innerText||'').trim()})()`))
  for (const t of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type: t, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
  }
  await sleep(500)
  /* 再点相邻的「结果判断」格:让 产线常规功能性结果 的编辑器失焦收格,再看它回显什么 */
  const pt2 = JSON.parse(String(await ev(`(()=>{
     const h=[...document.querySelectorAll('.el-table__header th')].map(t=>(t.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
     const ci=h.indexOf('结果判断');
     const tr=document.querySelector('.el-table__body-wrapper tbody tr');
     const td=tr.querySelectorAll('td')[ci]; const r=td.getBoundingClientRect();
     return JSON.stringify({x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}) })()`)))
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: pt2.x, y: pt2.y, button: 'left', clickCount: 1 })
  }
  await sleep(800)
  console.log('切到结果判断后 该行各格 =', await ev(`(()=>{const tr=document.querySelector('.el-table__body-wrapper tbody tr');return [...tr.querySelectorAll('td')].map((td,i)=>i+':'+(td.innerText||'').trim()+(td.querySelector('input')?'[编辑器]':'')).join(' | ')})()`))
  console.log('表内输入框数 =', await ev(`document.querySelectorAll('.el-table__body-wrapper input').length`))
} finally { try { edge.kill() } catch {} }

