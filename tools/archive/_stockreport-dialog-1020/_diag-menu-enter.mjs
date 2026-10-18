/**
 * _diag-menu-enter.mjs — 按**真实用户路径**复现「弹两次」:点左侧导航进入库存台账
 *
 * 之前的探针都是直接改 hash(相当于站内跳转),没走过「点菜单 → 路由 push → 页签新增」这条
 * 真实链路。用户报「还是两次」时,最该验的就是这条。
 *
 * 同时验两个常见路径:
 *   A. 仪表盘 → 点菜单 库存管理 ▸ 库存报表 ▸ 库存台账
 *   B. 已在台账页签时,再点一次同一个菜单项
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-menu-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9411', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9411/json/list')).json()
    const p = l.find((t) => t.type === 'page')
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b }); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }; break }
  } catch { /* retry */ }
  await sleep(500)
}
const send = (m, p) => { const i = ++id; return new Promise((r) => { pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')

// 用 token 注入 + reload 落到仪表盘(登录页表单选择器不稳,注入更确定),然后**只走菜单点击**
await send('Page.navigate', { url: HOST + '/#/login' })
await sleep(4500)
const lg = await (await fetch(HOST + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.navigate', { url: HOST + '/#/dashboard' }); await sleep(2500)
await send('Page.reload', { ignoreCache: false }); await sleep(9000)
console.log('落到:', await ev('location.hash'))

const state = () => ev(`(() => {
  const vis = (el) => { const cs=getComputedStyle(el); const ov=el.closest('.el-overlay');
    return cs.display!=='none' && (ov?getComputedStyle(ov).display!=='none':true) && el.offsetParent!==null }
  const all=[...document.querySelectorAll('.el-dialog')]
  return { 全部弹窗: all.length,
           可见查询弹窗: all.filter(vis).filter(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询').length,
           hash: location.hash,
           行数: document.querySelectorAll('.el-table__body tbody tr').length }
})()`)

// 展开左侧「库存管理」→「库存报表」→ 点「库存台账」
const clickText = (txt) => ev(`(() => {
  const els=[...document.querySelectorAll('a,span,div,li')].filter(e=>e.children.length===0 && (e.innerText||'').trim()===${JSON.stringify(txt)})
  const el=els[els.length-1]
  if(!el) return 'not-found'
  el.click(); return 'clicked'
})()`)

console.log('展开 库存管理:', await clickText('库存管理')); await sleep(1200)
console.log('展开 库存报表:', await clickText('库存报表')); await sleep(1200)
console.log('点 库存台账:', await clickText('库存台账'))
for (let i = 1; i <= 8; i++) { await sleep(1500); console.log(`菜单进入 +${i * 1.5}s:`, JSON.stringify(await state())) }

// B:已在该页签,再点一次同一菜单项
console.log('再点一次 库存台账:', await clickText('库存台账'))
for (let i = 1; i <= 4; i++) { await sleep(1500); console.log(`重复点击 +${i * 1.5}s:`, JSON.stringify(await state())) }

try { edge.kill() } catch {}
process.exit(0)
