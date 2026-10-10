/**
 * 一次性探针(2026-10-15):查清「前端还是没有更新」到底是
 *   ① 浏览器缓存(用户机器上旧 index.html / 旧 chunk),还是
 *   ② 服务端真的没换新前端。
 *
 * 做法:用**全新 profile** 的 Edge 打开 8090,记录 Network 里实际请求到的
 *   index.html 与 PanelxList chunk 的哈希;再与磁盘上的真源比对。
 *   新 profile 没有缓存 ⇒ 它拿到的就是"服务端当前真实提供的那一份"。
 *
 * 用法: node tools/archive/_probe-served-frontend-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, mkdtempSync } from 'node:fs'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const md5 = (b) => createHash('md5').update(b).digest('hex').toUpperCase()

const profile = mkdtempSync(join(tmpdir(), 'edge-fresh-'))
const port = 9337
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--incognito', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
const requests = []
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
        if (m.method === 'Network.responseReceived') requests.push(m.params.response.url)
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
await sleep(5000)

// 注入 token 并重载,再进「销售出库单」子路由 —— 只有进面板才会真正加载 PanelxList chunk
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (token) {
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
    + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
    + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
  await send('Page.reload', { ignoreCache: true })
  await sleep(6000)
  await ev(`location.hash = '#/panelx/list/SALE_OUT'; 'ok'`)
  await sleep(7000)
}

console.log('=== 全新 profile 访问 ' + host + ' 时实际请求到的 JS ===')
const jsReqs = [...new Set(requests)].filter((u) => u.includes('/assets/') && u.endsWith('.js'))
for (const u of jsReqs) console.log('  ' + u.replace(host, ''))

const entry = jsReqs.find((u) => /\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(u))
const inPage = await ev(`(() => { const s=[...document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')); return JSON.stringify(s) })()`)
console.log('\n=== 页面 DOM 里的 <script src> ===')
console.log('  ' + inPage)

// 页面内真实执行的 PanelxList 代码特征(取模块里是否含三面板左栏配置)
const railHit = await ev(`(async () => {
  const mods = performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/PanelxList-[A-Za-z0-9_-]+\\.js$/.test(n));
  if (!mods.length) return 'NO_PANELXLIST_REQ';
  const t = await (await fetch(mods[0])).text();
  return JSON.stringify({ url: mods[0], SALE_OUT: /SALE_OUT:\\s*\\["客户"\\]/.test(t), MATERIAL_OUT: /MATERIAL_OUT:\\s*\\["生产车间"\\]/.test(t), FINISH_IN: /FINISH_IN:\\s*\\["加工单号"\\]/.test(t), len: t.length });
})()`)
console.log('\n=== 页面实际取到的 PanelxList 内容检查 ===')
console.log('  ' + railHit)

console.log('\n=== 磁盘真源(应完全一致) ===')
for (const p of ['backend/src/main/resources/static/index.html', 'backend/src/main/resources/static/assets/PanelxList-Dc8lHXHF.js']) {
  try { console.log('  ' + p + '  md5=' + md5(readFileSync(p)).slice(0, 12) + '  size=' + readFileSync(p).length) } catch { console.log('  ' + p + '  (缺失)') }
}
try { edge.kill() } catch {}
process.exit(0)
