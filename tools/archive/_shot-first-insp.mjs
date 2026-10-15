/*
 * _shot-first-insp.mjs — 给首件检验纸张截一张整页图(人眼比对图片版式用)。
 * 会先按产品带入一次「取成型工艺清单」,让纸上出现真实测试项目列。
 * 用法: node tools/archive/_shot-first-insp.mjs [base] [out.png]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const OUT = process.argv[3] || 'tools/archive/_shot-first-insp.png'
const PORT = 9494
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fishot-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1400, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
  localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
await sleep(2500)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
  const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(600)

// 新建一张草稿,填产品编码,再「取成型工艺清单」带入真实列
await ev(`(() => {
  const btns=[...document.querySelectorAll('.approval-side [class*=as-side]')]
  const b=btns.find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok'
})()`)
await sleep(2000)
await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(600)
// 产品编码填一个真有成型工艺清单的(正式库 MP/产品编号 = 111 那张有值)
await ev(`(() => {
  const ins=[...document.querySelectorAll('.fi-sheet')]
  const box=document.querySelectorAll('.header-fields input, .head-grid input, form input')
  return box.length
})()`)
await sleep(300)
// 直接调接口把列带进内存:点工具栏「取成型工艺清单」前先写产品编码
const filled = await ev(`(() => {
  const inputs=[...document.querySelectorAll('input')].filter(i=>i.offsetParent)
  // 产品编码格:抬头里 label 为「产品编码」的值格
  const labels=[...document.querySelectorAll('th,label,span')].filter(e=>(e.innerText||'').trim()==='产品编码')
  for (const l of labels) {
    const cell=l.nextElementSibling
    const inp=cell?.querySelector?.('input')
    if (inp) {
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
      setter.call(inp,'111'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'set-111'
    }
  }
  return 'no-cell'
})()`)
console.log('产品编码填入 =', filled)
await sleep(700)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
console.log('已截图 →', OUT)
ws.close(); edge.kill()
