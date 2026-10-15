/**
 * 诊断(2026-10-15):curl 能拿到 INV 3874 行,但**浏览器里面板显示 0 行** —— 找出差异。
 *
 * 用户口径:「上次截图的后端是空的,显示的是没有数据的」。
 * 已知:同一 token / 同一接口,curl 正常返回 3874。
 *   ⇒ 差异只可能在:① 浏览器发的请求参数不同(如被前端加了权限过滤/条件);
 *                    ② 浏览器根本没发查询请求(前端提前 return);
 *                    ③ 浏览器发的请求失败(4xx/5xx)或返回体被前端判为无数据。
 *
 * 做法:CDP 打开面板,**把每一个 /px/ 请求的方法+URL+请求体+响应码+响应体前 300 字**都打出来。
 * 只读。用法: node tools/archive/_diag-browser-blank-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'edge-diag2-'))
const port = 9348
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const reqs = []          // {id, url, method, postData}
const resps = new Map()  // requestId -> {status, body}
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = async (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
        if (m.method === 'Network.requestWillBeSent') {
          const u = m.params.request.url
          if (u.includes('/px/') || u.includes('/auth/')) {
            reqs.push({ id: m.params.requestId, url: u.replace(host, ''), method: m.params.request.method, postData: (m.params.request.postData || '').slice(0, 300) })
          }
        }
        if (m.method === 'Network.responseReceived') {
          const u = m.params.response.url
          if (u.includes('/px/')) resps.set(m.params.requestId, { status: m.params.response.status, url: u.replace(host, '') })
        }
      }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)

reqs.length = 0
await ev(`location.hash = '#/panelx/list/INV'; 'ok'`)
await sleep(12000)

console.log('=== 浏览器发出的 /px/ 请求 ===')
for (const r of reqs) {
  const resp = resps.get(r.id)
  console.log(`${r.method} ${r.url}  -> ${resp ? resp.status : '(无响应)'}`)
  if (r.postData) console.log(`    body: ${r.postData}`)
}

const st = await ev(`(() => JSON.stringify({
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
  txt: (document.body.innerText.match(/第\\s*\\d+\\s*\\/\\s*\\d+\\s*张/)||['(无张数)'])[0],
}))()`)
console.log('\n=== 页面状态 ===')
console.log(st)

// 直接问页面:前端拿到的 token 与 localStorage 是否一致
const dbg = await ev(`(() => JSON.stringify({
  tokenHead: (localStorage.getItem('mes_token')||'').slice(0,20),
  user: (localStorage.getItem('mes_user')||'').slice(0,120),
  factory: localStorage.getItem('mes_factory'),
}))()`)
console.log('\n=== localStorage ===')
console.log(dbg)

try { edge.kill() } catch {}
process.exit(0)
