/*
 * _probe-first-insp-title-geom.mjs — 首件检验纸张「抬头区几何」量尺(2026-10-16 第二轮红框)。
 *
 * 用户口径(截图红框圈住大标题上方那块空白):「让当前的红框内容居于空白位置中央」。
 * 本探针只**量数**,不改任何东西:
 *   ① 纸张(.fi-sheet)的左右边界与中心线;
 *   ② 右上信息三格(.fi-info)占位(空白区 = 纸张减去它);
 *   ③ 大标题(.fi-title)的文字盒中心(横/纵);
 *   ④ 抬头四对表(.fi-head)的上沿(= 顶部空白带的底边)。
 * 输出一行 JSON + 一张纸张截图(便于人眼比对红框)。
 *
 * 用法: node tools/archive/_probe-first-insp-title-geom.mjs [base] [--shot out.png]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const shotIdx = process.argv.indexOf('--shot')
const SHOT = shotIdx > 0 ? process.argv[shotIdx + 1] : ''
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fig-'))
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
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
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
  // 起一张空草稿(抬头区才是可填的控件形态,与用户截图一致)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)

  const geom = await ev(`(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect()
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
               cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2) } }
    const sheet = document.querySelector('.fi-sheet')
    const info = document.querySelector('.fi-sheet .fi-info')
    const title = document.querySelector('.fi-sheet .fi-title')
    const head = document.querySelector('.fi-sheet .fi-head')
    const top = r(sheet)
    const i = r(info)
    return {
      sheet: top, info: i, title: r(title), head: r(head),
      // 空白区 = 纸张里、信息三格左侧、抬头表上方
      空白左: top ? top.x : null,
      空白右: i ? i.x : null,
      空白顶: top ? top.y : null,
      空白底: r(head) ? r(head).y : null,
      空白中心x: (top && i) ? Math.round((top.x + i.x) / 2) : null,
      空白中心y: (top && r(head)) ? Math.round((top.y + r(head).y) / 2) : null,
      纸张中心x: top ? top.cx : null,
    }
  })()`)
  console.log(JSON.stringify(geom, null, 1))
  if (SHOT) {
    // ⚠ clip 用的是**页面坐标**(含滚动偏移);getBoundingClientRect 给的是视口坐标,不加上 scroll 会整块偏掉
    const el = await ev(`(() => { const s = document.querySelector('.fi-sheet'); if (!s) return null
      const b = s.getBoundingClientRect()
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, w: b.width, h: b.height } })()`)
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: el.x, y: el.y, width: el.w, height: Math.min(el.h, 1400), scale: 1 },
    })
    fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64'))
    console.log('截图(纸张):' + SHOT)
    const page = await send('Page.captureScreenshot', { format: 'png' })     // 视口整页:人眼比对红框用
    const pagePath = SHOT.replace(/\.png$/i, '-page.png')
    fs.writeFileSync(pagePath, Buffer.from(page.result.data, 'base64'))
    console.log('截图(整页):' + pagePath)
  }
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
