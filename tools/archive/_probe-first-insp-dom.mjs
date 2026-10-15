/*
 * _probe-first-insp-dom.mjs — 把首件纸张「表头 vs 表体」的真实 DOM 结构打出来(排查列错位用)。
 * 用法: node tools/archive/_probe-first-insp-dom.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9496
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fidom-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
  localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
  localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
await sleep(2500)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
  const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(600)
await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
await sleep(2200)
await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(700)
// 加 3 列,分别落到不同分组:进 1 列(默认浊度及压降)、1 列改名为「炭棒表观状态」、1 列改名为「炭棒外径」
await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
await sleep(700)
const setCol = (idx, name) => ev(`(() => {
  const inputs=[...document.querySelectorAll('.fi-sheet .fi-grid thead .col-head input')]
  const inp=inputs[${idx}]; if(!inp) return 'no-input'
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
  setter.call(inp, ${JSON.stringify(name)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
})()`)
await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
await sleep(700)
console.log(await setCol(1, '炭棒表观状态'))
await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
await sleep(700)
console.log(await setCol(2, '炭棒外径mm'))
await sleep(900)

const dom = await ev(`(() => {
  const t = document.querySelector('.fi-sheet .fi-grid')
  const rows = [...t.querySelectorAll('tr')]
  return rows.map((tr, i) => ({
    row: i,
    cells: [...tr.children].map((td) => ({
      tag: td.tagName,
      cls: td.className,
      cs: td.getAttribute('colspan'),
      rs: td.getAttribute('rowspan'),
      txt: (td.querySelector('input') ? td.querySelector('input').value : (td.innerText || '')).replace(/\\s+/g, ' ').slice(0, 18),
    })),
  }))
})()`)
console.log(JSON.stringify(dom, null, 1))
ws.close(); edge.kill()
