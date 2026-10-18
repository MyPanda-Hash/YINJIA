/**
 * _q-375-overflow2.mjs —— 375 溢出二次定位:只看"是否在可横滚容器内"(排障用,只读)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const UI = 'http://127.0.0.1:8090'
const PORT = 9376
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ovf2-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=375,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch {} ; if (!tab) await sleep(500) }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: `${UI}/#/dashboard` }); await sleep(5000)
await ev(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(800)
console.log(await ev(`(() => {
  const box = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), r: Math.round(el.getBoundingClientRect().right),
    sw: el.scrollWidth, ovf: getComputedStyle(el).overflowX, max: getComputedStyle(el).maxWidth, width: getComputedStyle(el).width } : null
  const tabs = document.querySelector('.mod-tabs')
  const bar = document.querySelector('.mod-bar')
  const outside = Array.from(document.querySelectorAll('*')).filter((e) => {
    const r = e.getBoundingClientRect().right
    return r > window.innerWidth + 1 && !tabs?.contains(e)
  }).map((e) => ({ tag: e.tagName, cls: typeof e.className === 'string' ? e.className.slice(0, 40) : '',
    r: Math.round(e.getBoundingClientRect().right), txt: (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 20) })).slice(0, 10)
  return JSON.stringify({ win: window.innerWidth, doc: document.documentElement.scrollWidth,
    tabs: box(tabs), bar: box(bar), tabsParent: tabs ? tabs.parentElement.className : '', outside }, null, 1)
})()`))
ws.close(); edge.kill()
