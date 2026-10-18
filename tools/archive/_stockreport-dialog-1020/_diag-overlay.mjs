/**
 * _diag-overlay.mjs — 点✕之后那个「查询」弹窗到底是不是真可见?(逐层 style 取证)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'edge-ov-'))
const port = 9397
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch { /* retry */ }
  await sleep(500)
}
const send = (m, p) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.reload', { ignoreCache: true }); await sleep(8000)

const chain = () => ev(`(() => {
  const q = [...document.querySelectorAll('.el-dialog')]
    .filter(d => (d.querySelector('.el-dialog__title')?.innerText || '').trim() === '查询')
  return q.map((d, i) => {
    const walk = []
    let n = d
    for (let k = 0; k < 6 && n; k++) {
      const cs = getComputedStyle(n)
      walk.push({
        tag: n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.'),
        display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
        inline: n.getAttribute('style') || '',
        connected: n.isConnected,
        inBody: n.parentElement === document.body,
      })
      n = n.parentElement
    }
    return { i, walk }
  })
})()`)

const lines = []
const say = (s) => { console.log(s); lines.push(s) }

await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(2500)
await ev(`location.hash = '#/panelx/list/STOCK_LEDGER'; 'ok'`); await sleep(9000)
say('A 进入台账后:' + JSON.stringify(await chain(), null, 1))
await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); d?.querySelector('.el-dialog__headerbtn')?.click(); return 1 })()`)
await sleep(1500)
say('B 点✕ +1.5s:' + JSON.stringify(await chain()))
await sleep(3000)
say('C +4.5s:' + JSON.stringify(await chain()))
say('C hash=' + (await ev('location.hash')))

const fs = await import('node:fs')
const path = await import('node:path')
const { fileURLToPath } = await import('node:url')
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'diag-overlay.out'), lines.join('\n') + '\n')
try { edge.kill() } catch {}
process.exit(0)
