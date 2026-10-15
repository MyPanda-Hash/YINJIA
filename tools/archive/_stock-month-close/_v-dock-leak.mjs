/**
 * _v-dock-leak.mjs — 诊断:在「库存明细」勾了仓库后切到「库存状况表」,前端到底把什么条件发了出去
 *
 * 做法:进页面后 hook XMLHttpRequest.open/send,记录所有 queryFormDataList 的请求体;
 *   先开 STOCK_DETAIL(左栏未勾选 ⇒ 会带哨兵 _whCodes),再切 STOCK_BALANCE,把两次请求体打出来。
 * 用法:node tools/archive/_stock-month-close/_v-dock-leak.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '')
const api = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(`${api}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const { token, user } = login.data

const profile = mkdtempSync(join(tmpdir(), 'edge-leak-'))
const port = 9381
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })
let ws
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
  } catch { /* 等端口 */ }
  await sleep(250)
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${host}/#/login` })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: user.factory, name: '' }))});
  'ok'`)
await ev(`location.hash = '#/panelx/list/STOCK_DETAIL'; location.reload(); 'ok'`)
await sleep(10000)

// ⚠ hook 必须在**重载之后**装(重载会把 window 上的东西清掉 —— 第一版就踩了这个:
//   hook 装在登录页、reload 后 __q 不存在,读出来是 undefined)
await ev(`window.__q = [];
  (function(){ const o = XMLHttpRequest.prototype.open, s = XMLHttpRequest.prototype.send;
     XMLHttpRequest.prototype.open = function(m,u){ this.__u = u; return o.apply(this, arguments) };
     XMLHttpRequest.prototype.send = function(b){ if (String(this.__u||'').includes('queryFormDataList')) window.__q.push(String(b||'')); return s.apply(this, arguments) };
  })(); 'ok'`)
// 勾一个仓库,让「库存明细」自己的查询先跑一次
await ev(`(() => { const it = [...document.querySelectorAll('.wh-dock-item')].find(e => e.innerText.includes('恒亿仓'));
  const i = it && it.querySelector('input'); if (i) i.click(); return 'ok' })()`)
await sleep(5000)
console.log('[1] 库存明细(勾恒亿仓)发出去的请求体:')
for (const b of (await ev('window.__q.slice(-1)')) || []) console.log('    ' + b)
console.log('    页面条数: ' + await ev(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`))

console.log('[2] 切到「库存状况表」…')
await ev(`window.__q = []; location.hash = '#/panelx/list/STOCK_BALANCE'; 'ok'`)
await sleep(9000)
console.log('    切过去后发出去的请求体:')
for (const b of (await ev('window.__q')) || []) console.log('    ' + b)
console.log('    页面条数: ' + await ev(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`))

ws.close(); edge.kill()
