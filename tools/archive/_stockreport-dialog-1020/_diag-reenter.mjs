/**
 * _diag-reenter.mjs — 「离开台账→再进来」时弹窗门的时序取证(step C 失败定位)
 * 每 1s 打印:hash / 可见查询弹窗数 / 列表行数 / 弹窗内日期段
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'edge-re-'))
const port = 9398
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const p = list.find((t) => t.type === 'page')
    if (p?.webSocketDebuggerUrl) {
      ws = new WebSocket(p.webSocketDebuggerUrl)
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
const errs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params?.exceptionDetails?.exception?.description || '').split('\n')[0])
})
await send('Page.navigate', { url: host + '/#/login' }); await sleep(4000)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.reload', { ignoreCache: true }); await sleep(8000)

const obs = () => ev(`(() => {
  const vis = (el) => { if(!el) return false; const cs=getComputedStyle(el); const ov=el.closest('.el-overlay'); const ok=ov?getComputedStyle(ov).display!=='none':true; return cs.display!=='none'&&ov&&ok&&el.offsetParent!==null }
  const q=[...document.querySelectorAll('.el-dialog')].filter(vis).filter(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询')
  return { hash: location.hash, q: q.length, rows: document.querySelectorAll('.el-table__body tbody tr').length,
    range: q[0]?[...q[0].querySelectorAll('.el-date-editor input')].map(i=>i.value):[] }
})()`)

const lines = []
const say = (s) => { console.log(s); lines.push(s) }

say('--- 1) 首次进入台账 ---')
await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(3000)
await ev(`location.hash = '#/panelx/list/STOCK_LEDGER'; 'ok'`)
for (let i = 1; i <= 10; i++) { await sleep(1000); say(`  t=${i}s ${JSON.stringify(await obs())}`) }

say('--- 2) 点 ✕ 关闭 ---')
await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); d?.querySelector('.el-dialog__headerbtn')?.click(); return 1 })()`)
for (let i = 1; i <= 5; i++) { await sleep(1000); say(`  t=${i}s ${JSON.stringify(await obs())}`) }

say('--- 3) 重新进入台账(step C)---')
await ev(`location.hash = '#/panelx/list/STOCK_LEDGER'; 'ok'`)
for (let i = 1; i <= 14; i++) { await sleep(1000); say(`  t=${i}s ${JSON.stringify(await obs())}`) }
say('  JS 报错: ' + JSON.stringify(errs.slice(0, 5)))

const fs = await import('node:fs')
const path = await import('node:path')
const { fileURLToPath } = await import('node:url')
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'diag-reenter.out'), lines.join('\n') + '\n')
try { edge.kill() } catch {}
process.exit(0)
