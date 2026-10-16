/**
 * _q-flow-5173-diag.mjs —— 「5173(vite dev)上流程管控渲染 0 个节点」排障(只读)
 * 抓:console 错误/异常 + 点击页签后 .flow-board / .fb-node 是否存在 + 组件内文本片段
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-flow-5173-diag.mjs [uiBase]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const PORT = 9382
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-flowdiag-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch {} ; if (!tab) await sleep(500) }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
const logs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 300))
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    logs.push('[exception] ' + (d.exception?.description || d.text || '').slice(0, 400))
  }
  if (m.method === 'Log.entryAdded') {
    const en = m.params.entry
    if (en.level === 'error' || en.level === 'warning') logs.push('[log.' + en.level + '] ' + String(en.text).slice(0, 300))
  }
}
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(2000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: `${UI}/#/dashboard` }); await sleep(6000)
await ev(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(1000)
console.log('页签:', await ev(`Array.from(document.querySelectorAll('.mod-tab')).map(e=>e.textContent.trim()).join(' | ')`))
console.log('点流程管控:', await ev(`(() => { const b = Array.from(document.querySelectorAll('.mod-tab')).find(e => e.textContent.includes('流程管控')); b?.click(); return !!b })()`))
await sleep(4000)
console.log(JSON.stringify({
  flowBoard: await ev(`!!document.querySelector('.flow-board')`),
  chains: await ev(`document.querySelectorAll('.fb-chain').length`),
  nodes: await ev(`document.querySelectorAll('.fb-node').length`),
  cards: await ev(`document.querySelectorAll('.dashboard .card').length`),
  dashText: String(await ev(`(document.querySelector('.dashboard')?.innerText || '').replace(/\\s+/g,' ').slice(0, 260)`)),
}, null, 1))

/* 决定性测试:直接在页面里 import 这两个模块 —— 若模块本身编译/加载失败,这里会抛出真实错误 */
console.log('--- 直接 import 模块 ---')
console.log('flowSpec:', await ev(`import('/src/core/dashboard/flowSpec.js').then(m => 'OK keys=' + Object.keys(m).join(',')).catch(e => 'FAIL ' + e.message)`))
console.log('FlowBoard.vue:', await ev(`import('/src/views/dashboard/FlowBoard.vue').then(m => 'OK default=' + typeof m.default).catch(e => 'FAIL ' + e.message)`))

console.log('--- 控制台错误/异常(已滤掉 ElTooltip 噪音) ---')
const noise = /ElTooltip|ElPopper|ElOnlyChild|validation failed for prop "role"|Runtime directive used/
console.log(logs.filter((l) => !noise.test(l)).slice(0, 15).join('\n') || '(无其它)')
ws.close(); edge.kill()
