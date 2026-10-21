import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const BASE = 'http://localhost:5173'
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ } }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});localStorage.setItem('mes_locale','zh-CN');localStorage.setItem('mes_init_done','1');'ok'`)

/** 打开面板并等目录栏出现 */
async function open(code) {
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${code}` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.doc-select-rail')`)) break }
  await sleep(3000)
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说');if(b)b.click();const x=document.querySelector('.el-dialog__headerbtn');if(x)x.click();return 'ok'})()`)
  await sleep(500)
}
const leaveDialogOpen = async () => !!(await ev(`[...document.querySelectorAll('.el-dialog')].some(d => (d.innerText||'').includes('未保存提示'))`))
const clickLeave = async (label) => ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('未保存提示'));if(!d)return 'no-dialog';const b=[...d.querySelectorAll('button')].find(x=>(x.innerText||'').trim()===${JSON.stringify(label)});if(!b)return 'no-btn';b.click();return 'clicked'})()`)

for (const code of ['QC_PROC_INSP', 'QC_FIRST_INSP', 'QC_INSP']) {
  await open(code)
  console.log(`\n== ${code}`)
  // 点第二行
  await ev(`(()=>{const tr=document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')[1];if(tr)tr.click();return 'ok'})()`)
  await sleep(1000)
  const d1 = await leaveDialogOpen()
  console.log('  点第二行 → 未保存提示:', d1)
  if (d1) { console.log('  ', await clickLeave('不保存')); await sleep(1500) }
  console.log('  active=', await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')].findIndex(tr=>tr.classList.contains('active'))`))
  // 再点第三行(已切过一张,验证是否每次都弹)
  await ev(`(()=>{const tr=document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')[2];if(tr)tr.click();return 'ok'})()`)
  await sleep(1000)
  const d2 = await leaveDialogOpen()
  console.log('  点第三行 → 未保存提示:', d2)
  if (d2) { console.log('  ', await clickLeave('不保存')); await sleep(1500) }
  console.log('  active=', await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')].findIndex(tr=>tr.classList.contains('active'))`))
}
ws.close(); edge.kill(); process.exit(0)
