/**
 * _walk-tabcheck.cjs — 检查规格书「修订记录」Tab(en):点击页签后读取页面标题与表头
 * 用法: node --experimental-websocket tools/_walk-tabcheck.cjs [locale]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9346
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const LOCALE = process.argv[2] || 'en'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tab-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2500)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)});'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(800)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  const tabs = await evaluate(`[...document.querySelectorAll('.rsp-page-tab')].map((e) => e.textContent.trim())`)
  const clickIdx = await evaluate(`(() => { const tabs = [...document.querySelectorAll('.rsp-page-tab')]; const t = tabs.find((e) => e.textContent.trim() === ${JSON.stringify(LOCALE === 'en' ? 'Revisions' : '修订记录')}); if (!t) return -1; t.click(); return tabs.indexOf(t) })()`)
  await sleep(1200)
  const title = await evaluate(`document.querySelector('.rsp-page-title')?.textContent?.trim() || null`)
  const headers = await evaluate(`[...document.querySelectorAll('.rs-dt .rs-th')].map((e) => e.textContent.trim())`)
  const addBtn = await evaluate(`document.querySelector('.rs-add')?.textContent?.trim() || null`)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
  fs.writeFileSync(path.join(__dirname, '_walk', 'shots', 'RD_SPEC_DOC-rev-' + LOCALE + '.png'), Buffer.from(shot.result.data, 'base64'))
  console.log(JSON.stringify({ tabs, clickIdx, title, headers, addBtn }, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
