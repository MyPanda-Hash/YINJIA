/*
 * _probe-first-insp-layout.mjs — 首件检验单「抬头控件/提示条/列挤压」界面验收(2026-10-16 第五轮)
 *
 * 用户口径(截图三个框):
 *   ① 「当前这个生产日期的控件不要超出当前框体 … 增长当前生产日期框体长度让当前控件不会超出距离」
 *      ⇒ 生产日期那格给固定宽 240px,且格子里的控件按 100% 收口,控件矩形必须落在格子矩形内;
 *   ② 「删除黄框的内容」⇒ 纸张上不再有那条「本单同时有浊度与压降两项测试…」提示条;
 *   ③ 「修复当前红框会因为过多列而挤压的问题,当前实现可以拉滚动条移动」
 *      ⇒ 列多时不压扁:表格保底宽(行标签 96 + 每列 120 + 操作列 40),外面那层能横向滚动。
 *
 * 用法: node tools/archive/_probe-first-insp-layout.mjs [base] [--shot 前缀]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const shotIdx = process.argv.indexOf('--shot')
const SHOT = shotIdx > 0 ? process.argv[shotIdx + 1] : ''
const PORT = 9493
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fil-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2800)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(700)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)

  // ── ① 生产日期控件收在格子内 ───────────────────────────────────────────────
  const dateBox = await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    const ths = [...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText || '').trim() === '生产日期')
    if (i < 0) return { err: 'no-col' }
    const td = [...t.querySelectorAll('td')][i]
    const ctl = td.querySelector('.el-date-editor, input')
    if (!ctl) return { err: 'no-ctl' }
    const a = td.getBoundingClientRect(); const b = ctl.getBoundingClientRect()
    return { td: { l: Math.round(a.left), r: Math.round(a.right), w: Math.round(a.width) },
             ctl: { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) },
             fit: b.right <= a.right + 1 && b.left >= a.left - 1, width: Math.round(a.width) }
  })()`)
  console.log(`  生产日期格=${JSON.stringify(dateBox)}`)
  ok('① 找得到生产日期格与其中的日期控件', !dateBox?.err && !!dateBox?.ctl, JSON.stringify(dateBox))
  ok('① 日期控件**没有超出**格子边界', dateBox?.fit === true, JSON.stringify(dateBox))
  ok('① 生产日期格已加宽(≥200px)', Number(dateBox?.width) >= 200, `宽 ${dateBox?.width}px`)

  // ── ② 黄框那条提示已删除 ──────────────────────────────────────────────────
  const tips = await ev(`document.querySelectorAll('.fi-sheet .fi-tip').length`)
  ok('② 纸张上没有「浊度/压降」提示条(黄框内容已删)', Number(tips) === 0, String(tips))

  // ── ③ 列多不挤压:表格保底宽 + 外层横向滚动 ───────────────────────────────
  const before = await ev(`(() => {
    const wrap = document.querySelector('.fi-sheet .fi-grid-scroll')
    const th = document.querySelector('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')
    return { wrap: !!wrap, overflow: wrap ? wrap.scrollWidth > wrap.clientWidth : null,
             colW: th ? Math.round(th.getBoundingClientRect().width) : 0,
             n: document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head').length }
  })()`)
  // 连点表头右上角「＋」新增 7 列(模拟"过多列")
  for (let i = 0; i < 7; i++) {
    await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
    await sleep(350)
    await ev(`(() => { const x=document.querySelector('.el-message-box__btns button'); if(x && document.querySelector('.el-message-box')) x.click(); return 'ok' })()`)
  }
  await sleep(900)
  const after = await ev(`(() => {
    const wrap = document.querySelector('.fi-sheet .fi-grid-scroll')
    const th = document.querySelector('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')
    return { wrap: !!wrap, overflow: wrap ? wrap.scrollWidth > wrap.clientWidth : null,
             scrollW: wrap ? wrap.scrollWidth : 0, clientW: wrap ? wrap.clientWidth : 0,
             colW: th ? Math.round(th.getBoundingClientRect().width) : 0,
             n: document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head').length,
             minW: document.querySelector('.fi-sheet .fi-grid')?.style?.minWidth || '' }
  })()`)
  console.log(`  列数 ${before?.n} → ${after?.n};列宽 ${before?.colW} → ${after?.colW};` +
    `滚动 ${after?.scrollW}/${after?.clientW};minWidth=${after?.minW}`)
  ok('③ 数据区外面有横向滚动容器', after?.wrap === true, JSON.stringify(after))
  ok('③ 列变多后表格**溢出容器**(可拉滚动条,不是压缩)', after?.overflow === true, JSON.stringify(after))
  ok('③ 每列宽度保住 100px 以上(没有被压扁)', Number(after?.colW) >= 100,
    `${before?.colW}px → ${after?.colW}px`)
  ok('③ 表格挂了按列数算的最小宽', /px$/.test(String(after?.minW)), String(after?.minW))
  await ev(`(() => { const w=document.querySelector('.fi-sheet .fi-grid-scroll'); if(w) w.scrollLeft = w.scrollWidth; return 'ok' })()`)
  await sleep(400)

  if (SHOT) {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`${SHOT}.png`, Buffer.from(s.result.data, 'base64'))
    console.log('截图:' + `${SHOT}.png`)
  }
  ok('④ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验单版面三项修复:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
