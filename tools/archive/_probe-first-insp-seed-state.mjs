/*
 * _probe-first-insp-seed-state.mjs — 排查"打开首件检验单还是空表":
 * 打印面板当前单据状态、明细行数、纸张列数,以及"新建"前后各是什么。
 * 用法: node tools/archive/_probe-first-insp-seed-state.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9497
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-seed-'))
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
await sleep(800)

const snap = (tag) => ev(`(() => {
  const s = document.querySelector('.fi-sheet')
  const cols = s ? [...s.querySelectorAll('.fi-grid thead .col-head')].map(e => (e.querySelector('.fi-colname input')||{}).value || '') : []
  const sampleRows = s ? s.querySelectorAll('.sample-row').length : 0
  const side = [...document.querySelectorAll('.approval-side [class*=as-side]')].map(e => (e.innerText||'').trim()).filter(Boolean)
  return {
    tag: ${JSON.stringify(tag)},
    sheet: !!s,
    cols: cols.length, colNames: cols.slice(0, 12),
    sampleRows,
    emptyHint: (s?.querySelector('.fi-empty')?.innerText || '').trim(),
    // 侧栏「第 x/y 张」与状态胶囊,判断是不是"根本没打开单据"
    pager: (document.querySelector('.as-side-pager')?.innerText || '').replace(/\\s+/g, ' ').trim(),
    status: (document.querySelector('.as-side-status-row')?.innerText || '').trim(),
    hasDelete: side.includes('删除'),
  }
})()`)

console.log('打开面板初始态:', JSON.stringify(await snap('初始'), null, 0))
await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
await sleep(2500)
await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(900)
console.log('点「新增」后 :', JSON.stringify(await snap('新增后'), null, 0))
ws.close(); edge.kill()
