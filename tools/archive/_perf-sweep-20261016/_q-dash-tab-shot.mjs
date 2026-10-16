/**
 * _q-dash-tab-shot.mjs —— 桌面某页签的活体截图(验收取证)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-dash-tab-shot.mjs [uiBase] [页签名] [输出名]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const TAB = process.argv[3] || '生产'
const NAME = process.argv[4] || 'dash-prod'
const PORT = 9412
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(import.meta.dirname, '_shots')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = JSON.parse(await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text())

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tab-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,1100',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 */ }
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: `${UI}/#/dashboard` }); await sleep(6000)
await ev(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(800)
console.log('切到页签「' + TAB + '」: ' + await ev(`(() => { const b = Array.from(document.querySelectorAll('.mod-tab')).find(e => e.textContent.includes(${JSON.stringify(TAB)})); b?.click(); return !!b })()`))
await sleep(5000)
let r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
if (!r?.result?.data) { await sleep(900); r = await send('Page.captureScreenshot', { format: 'png' }) }
fs.writeFileSync(path.join(OUT, NAME + '.png'), Buffer.from(r.result.data, 'base64'))
console.log('截图: ' + path.join(OUT, NAME + '.png'))
console.log('卡片文本抽样: ' + String(await ev(`document.body.innerText.replace(/\\s+/g,' ').slice(0, 420)`)))
ws.close(); edge.kill()
