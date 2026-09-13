/**
 * _walk-pagecheck.cjs — 诊断文书式面板翻页(末页切换是否真正加载单据)
 * 用法: node --experimental-websocket tools/_walk-pagecheck.cjs RD_ASM_BOM
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9345
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PC = process.argv[2] || 'RD_ASM_BOM'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
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
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2500)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(800)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/' + PC }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  const read = async () => await evaluate(`(() => ({
    docno: document.querySelector('.rs-docno')?.textContent?.trim() || null,
    chip: document.querySelector('.tools .doc-chip')?.textContent?.trim() || null,
    pager: document.querySelector('.as-side-pager')?.textContent?.replace(/\\s+/g, ' ').trim() || null,
    headVal: [...document.querySelectorAll('.rs-td .rs-t-in, .rs-td .rs-txt')].slice(0, 3).map((e) => e.value ?? e.textContent.trim()).join('|'),
  }))()`)
  const before = await read()
  const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-pager .page-btn')].find(e => e.getAttribute('title') === '末页'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
  await sleep(2500)
  const after = await read()
  const errs = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join('|')`)
  console.log(JSON.stringify({ before, clicked, after, errs }, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
