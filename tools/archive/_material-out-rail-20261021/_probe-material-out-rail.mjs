/**
 * _probe-material-out-rail.mjs — 材料出库单「单据选择」左栏列头取证(2026-10-21)
 *
 * 背景:用户口径「单据选择那里也要修改 —— 只是左栏那列标题要变成「生产线」」。
 * 字段改名(yj_field.label 生产车间→生产线)后,左栏列头应当跟着变。
 * 本探针只读,不写库:登录 → 打开材料出库单列表 → 读左栏表头 + 若干行单元格。
 *
 * 用法:node tools\archive\_material-out-rail-20261021\_probe-material-out-rail.mjs [URL]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const UI = process.argv[2] || 'http://127.0.0.1:8090'
const W = 1440
const H = 900
const PORT = 9417
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
if (!lg?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lg).slice(0, 200))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rail-'))
spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + W + ',' + H,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3500)
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
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1800)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: `${UI}/#/panelx/list/MATERIAL_OUT` }); await sleep(5500)

const rail = JSON.parse(await ev(`JSON.stringify({
  rail: !!document.querySelector('.doc-select-rail, .rail, [class*="rail"]'),
  heads: Array.from(document.querySelectorAll('[class*="rail"] th, [class*="rail"] .rail-head-cell, [class*="rail"] [class*="head"] span')).map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 14),
  railText: (document.querySelector('[class*="rail"]')?.innerText || '').slice(0, 400),
})`))

const out = []
const ok = (n, p, d = '') => { out.push({ n, p }); console.log(`${p ? '  ✔' : '  ✘'} ${n}${d ? '  ' + d : ''}`) }
ok('左栏「单据选择」存在', rail.rail === true, '')
ok('左栏列头含「生产线」', rail.heads.includes('生产线') || rail.railText.includes('生产线'), JSON.stringify(rail.heads))
ok('左栏不再出现「生产车间」', !rail.railText.includes('生产车间'), '')

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
const dir = path.join(process.cwd(), 'tools', 'archive', '_material-out-rail-20261021')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'rail.png'), Buffer.from(shot.result.data, 'base64'))
console.log('\n截图: ' + path.join(dir, 'rail.png'))
const pass = out.filter((x) => x.p).length
console.log(`\n=== ${pass}/${out.length} 通过 ===`)
process.exit(pass === out.length ? 0 : 1)
