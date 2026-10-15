/*
 * _probe-first-insp-order.mjs — 列序取证:打印纸张「表头两级 + 表体首行」的真实顺序。
 * 只读,不落库。用法: node tools/archive/_probe-first-insp-order.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ord-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
await sleep(3000)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
  const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(800)
await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
await sleep(3000)
await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(900)

// 新建 4 列,检测它们是否插入到图片 10 列**之前**
for (let i = 0; i < 4; i++) {
  await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
  await sleep(700)
}
await sleep(1000)

const dump = await ev(`(() => {
  const s = document.querySelector('.fi-sheet')
  if (!s) return { err: 'no sheet' }
  const name = (th) => (th.querySelector('.fi-colname input') || {}).value || (th.innerText || '').trim()
  return {
    groups: [...s.querySelectorAll('.fi-grid thead .group')].map(e => (e.innerText||'').trim()),
    heads: [...s.querySelectorAll('.fi-grid thead .col-head')].map(name),
    row0: [...s.querySelector('.standard-row')?.children || []].slice(1).map(td => (td.innerText||'').trim().slice(0,6)),
    count: s.querySelectorAll('.fi-grid thead .col-head').length,
  }
})()`)
console.log('列总数 =', dump.count)
console.log('分组   =', JSON.stringify(dump.groups))
console.log('表头序 =', JSON.stringify(dump.heads))
console.log('标准行 =', JSON.stringify(dump.row0))
ws.close(); edge.kill()
