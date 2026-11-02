/**
 * 一次性探针(2026-10-31 第二轮):**送料暂收单**的生单 / 批量生单界面存证。
 *
 * 用户报障原话:「所有单据只要有生单和批量生单这个按钮的,都要实现,**送料暂收就不能批量,
 * 而且生单也没有勾选**」——本探针就验这一条:左栏勾选 + 生单组下拉里的「批量生单」+
 * 单张/多张两种对话框(目标显示为「来料检验单 / 采购入库单」,因为它是按商品档案逐行分流)。
 *
 * 产物: tools/archive/_probe-batch-generate-20261031/07..09-*.png
 * 只读:不点「确定生单」。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_probe-batch-generate-20261031'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-qc-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9338', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9338/json/list')).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('  -> ' + OUT + '/' + name)
}
const dialogsOpen = () => ev(`document.querySelectorAll('.gl-doc').length`)
async function closeAll() {
  for (let i = 0; i < 8; i++) {
    if (!(await dialogsOpen())) return
    await ev(`(() => {
      const btns = [...document.querySelectorAll('.el-dialog__headerbtn')]
      for (const b of btns) b.click()
      return true
    })()`)
    await sleep(500)
  }
}
const summary = () => ev(`(() => {
  const docs = [...document.querySelectorAll('.gl-doc')]
  return {
    title: document.querySelector('.el-dialog .el-dialog__title')?.innerText.trim(),
    docCount: docs.length,
    docNos: docs.map(d => d.querySelector('.gl-doc-no')?.innerText.trim()),
    rowCounts: docs.map(d => d.querySelectorAll('tbody tr').length),
    pills: docs.map(d => d.querySelector('.gl-picked')?.innerText.trim()),
    foot: document.querySelector('.gl-foot')?.innerText.trim(),
    bar: [...document.querySelectorAll('.gl-bar .gl-chip')].map(x => x.innerText.trim()),
    columns: docs[0] ? [...docs[0].querySelectorAll('thead th')].map(t => t.innerText.trim()).filter(Boolean) : [],
  }
})()`)
const GEN = `[...document.querySelectorAll('.tools .tb-group')]
  .find(x => /^(生单|Generate)$/i.test((x.querySelector('.act-name')?.innerText || '').trim()))`
const openDropdown = async () => {
  await ev(`(() => { const g = ${GEN}; if (!g) return false; if (!g.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.click(); return true })()`)
  await sleep(400)
  return ev(`[...document.querySelectorAll('.tools .tb-menu .ctx-item')].map(x=>x.innerText.trim())`)
}
const clickItem = async (label) => {
  await ev(`(() => { const g = ${GEN}; if (!g) return false; if (!g.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.click(); return true })()`)
  await sleep(400)
  return ev(`(() => {
    const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find(x => x.innerText.trim() === ${JSON.stringify(label)})
    if (!it) return false
    it.click(); return true
  })()`)
}

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await ev(`localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)

await send('Page.navigate', { url: UI + '/#/panelx/list/QC_RECV' })
await sleep(2500)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)
await ev(`location.hash = '#/panelx/list/QC_RECV'; 'ok'`)
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.doc-select-rail')`)) break; await sleep(400) }
await sleep(1500)

console.log('== 送料暂收单 ==')
console.log('  左栏表头 =', JSON.stringify(await ev(`[...document.querySelectorAll('.doc-select-rail thead th')].map(th=>th.innerText.trim())`)))
console.log('  勾选框数 =', await ev(`document.querySelectorAll('.doc-select-rail tbody td.dsr-check').length`))
await shot('07-qc-recv-rail.png')

// 先测"单张生单"(主按钮)—— 必须先把当前单据切到一张**已审核**的(草稿态「生单」按设计是灰的)
console.log('-- 生单(主按钮)= 单张 --')
const pickedAudited = await ev(`(() => {
  const trs = [...document.querySelectorAll('.doc-select-rail tbody tr')]
  const hit = trs.find((tr) => tr.innerText.includes('已审核'))
  if (!hit) return ''
  hit.click()
  return hit.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60)
})()`)
await sleep(1500)
console.log('  当前单据 =', JSON.stringify(pickedAudited))
await ev(`(() => { const g = ${GEN}; g?.querySelector('.tb-main')?.click(); return true })()`)
for (let i = 0; i < 40; i++) { if (await dialogsOpen()) break; await sleep(300) }
await sleep(800)
console.log('  ' + JSON.stringify(await summary()))
await shot('09-qc-recv-single-dialog.png')
await closeAll()

// 再测"勾两张 → 批量生单"
const clicked = await ev(`(() => {
  const trs = [...document.querySelectorAll('.doc-select-rail tbody tr')].slice(0, 2)
  let n = 0
  for (const tr of trs) { const b = tr.querySelector('td.dsr-check .el-checkbox'); if (b) { b.click(); n++ } }
  return n
})()`)
await sleep(500)
console.log('  左栏勾选', clicked, '张 →', JSON.stringify(await ev(`document.querySelector('.dsr-picked')?.innerText.trim()`)))
await shot('08-qc-recv-rail-checked.png')
console.log('  生单下拉 =', JSON.stringify(await openDropdown()))
console.log('  点批量生单 =', await clickItem('批量生单'))
for (let i = 0; i < 40; i++) { if (await dialogsOpen()) break; await sleep(300) }
await sleep(900)
console.log('  ' + JSON.stringify(await summary()))
await shot('08-qc-recv-batch-dialog.png')
await closeAll()

try { edge.kill() } catch {}
console.log('DONE(未生成任何单据)')
process.exit(0)
