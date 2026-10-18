/**
 * _diag-switch-panels.mjs — 台账 ↔ 收发存汇总 来回切换时的弹窗数(用户原话涉及这两个面板)
 *
 * 场景:
 *  1) 菜单进台账(弹窗开) → 不关直接点「收发存汇总」→ 再点回「库存台账」
 *  2) 台账查一次 → 切汇总 → 切回台账
 * 每步打印:可见「查询」弹窗数 / 全部弹窗数 / 各弹窗标题
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-sw-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9413', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9413/json/list')).json()
    const p = l.find((t) => t.type === 'page')
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b }); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }; break }
  } catch { /* retry */ }
  await sleep(500)
}
const send = (m, p) => { const i = ++id; return new Promise((r) => { pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')

await send('Page.navigate', { url: HOST + '/#/login' }); await sleep(4500)
const lg = await (await fetch(HOST + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.navigate', { url: HOST + '/#/dashboard' }); await sleep(2500)
await send('Page.reload', { ignoreCache: false }); await sleep(9000)

const st = () => ev(`(() => {
  const vis = (el) => { const cs=getComputedStyle(el); const ov=el.closest('.el-overlay');
    return cs.display!=='none' && (ov?getComputedStyle(ov).display!=='none':true) && el.offsetParent!==null }
  const all=[...document.querySelectorAll('.el-dialog')]
  const v=all.filter(vis)
  return { 可见查询: v.filter(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询').length,
           可见全部: v.length, 标题: v.map(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()),
           全部节点: all.length, hash: location.hash, 行数: document.querySelectorAll('.el-table__body tbody tr').length }
})()`)
const clickText = (txt) => ev(`(() => {
  const els=[...document.querySelectorAll('a,span,div,li')].filter(e=>e.children.length===0 && (e.innerText||'').trim()===${JSON.stringify(txt)})
  const el=els[els.length-1]; if(!el) return 'not-found'; el.click(); return 'clicked'
})()`)

console.log('展开 库存管理:', await clickText('库存管理')); await sleep(1000)
console.log('展开 库存报表:', await clickText('库存报表')); await sleep(1000)

console.log('\n--- 1) 进台账 ---')
console.log('点 库存台账:', await clickText('库存台账')); await sleep(9000)
console.log('   ', JSON.stringify(await st()))

console.log('\n--- 2) 不关弹窗,直接切到汇总 ---')
console.log('点 收发存汇总表:', await clickText('收发存汇总表'))
for (let i = 1; i <= 4; i++) { await sleep(2000); console.log(`   +${i * 2}s`, JSON.stringify(await st())) }

console.log('\n--- 3) 切回台账 ---')
console.log('点 库存台账:', await clickText('库存台账'))
for (let i = 1; i <= 4; i++) { await sleep(2000); console.log(`   +${i * 2}s`, JSON.stringify(await st())) }

console.log('\n--- 4) 再切汇总、再切台账各一次 ---')
await clickText('收发存汇总表'); await sleep(6000)
console.log('   汇总:', JSON.stringify(await st()))
await clickText('库存台账'); await sleep(6000)
console.log('   台账:', JSON.stringify(await st()))

try { edge.kill() } catch {}
process.exit(0)
