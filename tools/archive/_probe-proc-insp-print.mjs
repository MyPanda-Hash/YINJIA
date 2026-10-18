/*
 * _probe-proc-insp-print.mjs — 制程检验单(QC_PROC_INSP)侧栏「打印」的**空白页取证**(2026-10-17)
 *
 * 发现(查首件检验单报表模板时顺带撞到的,与本轮修复无关,**尚未修**):
 *   公共打印样式把 body.approval-printing .portal 整体 visibility:hidden,再逐个白名单纸张根类名
 *   (.approval-sheet/.progress-sheet/.catalog-sheet/.qc-rec-sheet/.rsp-sheet),而 **.qr-sheet 不在名单里**
 *   ⇒ 制程检验单点「打印」出来是一张白纸(实测 printToPDF = 1149 字节空白页,
 *   getComputedStyle(.qr-sheet).visibility === 'hidden')。
 *
 * 顺带纠正一个易混点:「制程检验单已经存在实现」指的是**导出报表那条路**(服务端 qc_proc_insp.jrxml),
 *   不是侧栏这个浏览器打印按钮 —— 两者是不同的通道。
 *
 * 用法: node tools/archive/_probe-proc-insp-print.mjs [base] [panelCode] [输出pdf]
 *       默认 http://127.0.0.1:5173 / QC_PROC_INSP / tools/archive/_tmp-<panel>-print.pdf
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const PANEL = process.argv[3] || 'QC_PROC_INSP'
const PORT = 9507
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
const tbl = PANEL === 'QC_PROC_INSP' ? 'qc_proc_insp_head' : 'qc_first_insp_head'
console.log('库内单据 =', JSON.stringify(await q(`SELECT TOP 5 单据编号 FROM dbo.${tbl} ORDER BY id DESC`)))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-procprint-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1200, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
  localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
  localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${PANEL}` })
for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
await sleep(3000)
await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
  const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(800)
// 查询单据 → 选第一张
const btn = await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side], .approval-side button')]
  .find((x) => (x.innerText||'').trim()==='查询单据'); if(b){b.click(); return 'ok'} return 'nobtn' })()`)
console.log('点查询单据 =', btn)
await sleep(2500)
await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tbody tr'); if(tr) tr.click(); return 'ok' })()`)
await sleep(800)
await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
await sleep(3000)
await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
await sleep(1200)
console.log('纸面根 =', JSON.stringify(await ev(`(() => {
  const list = ['.qr-sheet', '.fi-sheet', '.qc-rec-sheet', '.approval-sheet', '.catalog-sheet']
  return list.map((s) => ({ sel: s, hit: !!document.querySelector('.approval-layout ' + s) })).filter((x) => x.hit)
})()`)))
console.log('单据编号 =', await ev(`(document.querySelector('.fi-sheet input, .qr-sheet input')?.value || '(读到第一个 input)')`))

await ev(`document.body.classList.add('approval-printing')`)
await sleep(300)
await send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(600)
console.log('打印媒体下 =', JSON.stringify(await ev(`(() => {
  const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
    return { display: cs.display, visibility: cs.visibility, w: Math.round(r.width) } }
  return { sheet: vis('.approval-layout > *'), side: vis('.approval-side'), top: vis('.topbar') }
})()`)))
const r = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
const out = process.argv[4] || `tools/archive/_tmp-${PANEL}-print.pdf`
fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'))
console.log('打印产物 =', out, fs.statSync(out).size, 'bytes')
ws.close(); edge.kill()
await pool.close()
