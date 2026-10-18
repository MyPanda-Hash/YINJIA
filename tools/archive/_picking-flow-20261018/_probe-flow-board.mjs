/**
 * _probe-flow-board.mjs — 流程管控看板「排产 → 领料」顺序的界面探针(2026-10-18)
 *
 * 用户口径:「先要完成排产才进入到领料」——看板第二泳道必须画成
 *   快速排产 → 工单排产/预排线 → 产线排产负荷 → **材料出库单**,
 *   且泳道名/箭头文案不再出现「领料与排产」。
 *
 * 用法(仓库根,需 5173 与 8090 都在跑):node tools/archive/_picking-flow-20261018/_probe-flow-board.mjs
 * 产物:tools/archive/_picking-flow-20261018/flow-board.png
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = process.env.MES_UI || 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9341
const OUT = 'tools/archive/_picking-flow-20261018'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log(`  [PASS] ${m}`) } else { fail++; console.log(`  [FAIL] ${m}`) } }

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-flow-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1200', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch { /* 还没起来 */ }
  await sleep(500)
}
if (!ws) { console.error('连不上 Edge CDP'); process.exit(2) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)

await send('Page.navigate', { url: UI + '/#/dashboard' })
await sleep(1500)
await send('Page.reload', { ignoreCache: true })
await sleep(4000)
// 桌面默认停在「概览」页签 —— 切到「流程管控」才渲染 FlowBoard
for (let i = 0; i < 20; i++) {
  const clicked = await ev(`(() => {
    const t = [...document.querySelectorAll('.mod-tab')].find(e => e.innerText.trim() === '流程管控')
    if (!t) return false
    t.click(); return true
  })()`)
  if (clicked) break
  await sleep(500)
}
for (let i = 0; i < 40; i++) {
  if (await ev(`!!document.querySelector('.flow-board .fb-lane')`)) break
  await sleep(500)
}
await sleep(1500)

console.log('\n[1] 生产链泳道与节点顺序(界面实际渲染)')
const lanes = await ev(`[...document.querySelectorAll('.fb-chain')].map(c => ({
  chain: c.querySelector('.fb-title')?.innerText.trim(),
  lanes: [...c.querySelectorAll('.fb-lane')].map(l => ({
    name: l.querySelector('.fb-lane-name')?.innerText.trim(),
    nodes: [...l.querySelectorAll('.fb-node-name')].map(n => n.innerText.trim())
  }))
}))`)
const prod = (lanes || []).find((c) => c.chain === '生产过程')
ok(!!prod, `生产链渲染出来:${(lanes || []).map((c) => c.chain).join(' / ')}`)
const release = prod?.lanes?.[1]
ok(release?.name === '排产与领料', `第二泳道名 = ${release?.name}`)
console.log('     节点顺序 =', (release?.nodes || []).join(' → '))
const idx = (n) => (release?.nodes || []).findIndex((x) => x === n)
ok(idx('快速排产') >= 0 && idx('材料出库单') > idx('快速排产'), '材料出库单排在快速排产之后(先排产后领料)')
ok(idx('工单排产 / 预排线') >= 0 && idx('材料出库单') > idx('工单排产 / 预排线'), '材料出库单排在工单排产之后')
ok(idx('产线排产负荷') >= 0 && idx('材料出库单') > idx('产线排产负荷'), '材料出库单排在产线排产负荷之后')

console.log('\n[2] 泳道间箭头文案(不再写「转领料单 / 排产」)')
const tags = await ev(`[...document.querySelectorAll('.fb-down-tag')].map(e => e.innerText.trim())`)
console.log('     文案 =', JSON.stringify(tags || []))
ok((tags || []).includes('排产完成 → 转领料单'), '箭头文案 = 排产完成 → 转领料单')

console.log('\n[3] 节点说明与列头(领料口径已改)')
const matoutNote = await ev(`(() => {
  const prod = [...document.querySelectorAll('.fb-chain')].find(c => c.querySelector('.fb-title')?.innerText.trim() === '生产过程')
  const mat = [...(prod?.querySelectorAll('.fb-node') || [])].find(b => b.querySelector('.fb-node-name')?.innerText.trim() === '材料出库单')
  return mat?.getAttribute('title') || ''
})()`)
console.log('     材料出库单说明 =', matoutNote)
ok(/排产入线后才放行/.test(matoutNote) && /一张工单行可开多张/.test(matoutNote), '说明含「排产入线后才放行」「一张工单行可开多张」')
const intro = await ev(`[...document.querySelectorAll('.fb-chain')].find(c => c.querySelector('.fb-title')?.innerText.trim() === '生产过程')?.querySelector('.fb-intro')?.innerText.trim()`)
console.log('     生产链简介 =', intro)
ok(/排产 → 领料/.test(intro || ''), '生产链简介为 排产 → 领料')

const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result?.data) {
  writeFileSync(join(OUT, 'flow-board.png'), Buffer.from(shot.result.data, 'base64'))
  console.log(`\n截图: ${OUT}/flow-board.png`)
}
await ev(`localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
try { edge.kill() } catch { /* ignore */ }
console.log(`\n== 结果: ${pass} 通过 / ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
