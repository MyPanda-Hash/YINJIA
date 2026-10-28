/* 2026-10-28 验证:主界面「新建加工单」入口已恢复,点击后进入现役生产工单页面(不是旧表单)。只读。 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.dirname(fileURLToPath(import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch('http://localhost:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
const token = login.data.token
const user = login.data.user

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-desk-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(2500); return } } }

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false })
  await navigate('http://localhost:5173/#/login')
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
  await navigate('about:blank')
  await navigate('http://localhost:5173/#/dashboard')

  const before = await evaluate(`(() => ({
    buttons: [...document.querySelectorAll('.quick .el-button')].map((b) => b.innerText.trim()),
    hash: location.hash
  }))()`)
  const png = (await send('Page.captureScreenshot', { format: 'png' })).result.data
  fs.writeFileSync(path.join(OUT, 'dashboard.png'), Buffer.from(png, 'base64'))

  await evaluate(`(() => { const b = [...document.querySelectorAll('.quick .el-button')].find((x) => x.innerText.includes('新建加工单')); b && b.click(); return !!b })()`)
  await sleep(3000)
  const after = await evaluate(`(() => ({
    hash: location.hash,
    title: document.title,
    rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    heading: [...document.querySelectorAll('*')].find((e) => e.innerText === '生产工单')?.innerText || ''
  }))()`)

  console.log(JSON.stringify({ before, after }, null, 2))
  ws.close()
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
