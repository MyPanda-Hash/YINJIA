/**
 * _q-375-overflow.mjs —— 375 宽下横向溢出真凶定位(只读,排障用)
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-375-overflow.mjs [uiBase] [route]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const ROUTE = process.argv[3] || '/#/dashboard'
const PORT = 9375
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ovf-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=375,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch {}
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: UI + ROUTE }); await sleep(5000)
await ev(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(800)

const info = await ev(`JSON.stringify({
  win: window.innerWidth,
  docScroll: document.documentElement.scrollWidth,
  bodyScroll: document.body.scrollWidth,
  widest: Array.from(document.querySelectorAll('*')).map(e => ({
    tag: e.tagName, cls: (typeof e.className === 'string' ? e.className.split(' ').slice(0,2).join('.') : ''),
    w: Math.round(e.getBoundingClientRect().width), r: Math.round(e.getBoundingClientRect().right),
    ovf: getComputedStyle(e).overflowX,
    scrollW: e.scrollWidth
  })).filter(o => o.r > window.innerWidth + 1 || o.scrollW > o.w + 1)
    .sort((a,b) => b.r - a.r).slice(0, 12)
})`)
console.log(JSON.stringify(JSON.parse(info), null, 1))
ws.close(); edge.kill()
