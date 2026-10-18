/**
 * _probe-flow-block-jump.mjs — 「当前卡点」气泡跳转的界面探针(2026-10-18)
 *
 * 用户报障:「当前这上方的卡点转跳页面好像有问题,转跳的内容是……旧的生产工单」——
 * 根因:气泡只传 panelCode,前端一律拼 `/panelx/list/<code>`;
 * 而 ORDER_CONVERT / SCHEDULE_BOARD / WORK_ORDER_BOARD / WORK_ORDER_LIST 是**页面级**面板
 * (yj_panel 无行)⇒ 落到空白面板壳(工具栏 + 「第 0 张」)。
 *
 * 断言:点每个气泡后落到的路由与页面根节点都对(专页必须是专页,普通面板才走面板壳)。
 *
 * 用法(仓库根,需 5173 或 8090 在跑):
 *   node tools/archive/_picking-flow-20261018/_probe-flow-block-jump.mjs
 *   MES_UI=http://127.0.0.1:8090 node tools/archive/_picking-flow-20261018/_probe-flow-block-jump.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = process.env.MES_UI || 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9342
const OUT = 'tools/archive/_picking-flow-20261018'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log(`  [PASS] ${m}`) } else { fail++; console.log(`  [FAIL] ${m}`) } }

/** 气泡名 → { hash 片段, 页面根选择器 } */
const EXPECT = {
  订单待结转: { hash: '/prod/plan/orderConvert', root: '.oc-page' },
  待排产工单: { hash: '/prod/plan/scheduleBoard', root: '.sb-page' },
  '工单未排产(行)': { hash: '/prod/plan/workOrderList', root: '.wol-page' },
  产成品入库待审核: { hash: '/panelx/list/FINISH_IN', root: '.panelx-list' },
}

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-jump-'))
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
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
// 令牌是页面启动时从 localStorage 读进 store 的 —— 种完必须**整页重载**一次,否则路由守卫仍按未登录处理
await send('Page.navigate', { url: UI + '/#/dashboard' })
await sleep(1500)
await send('Page.reload', { ignoreCache: false })
await sleep(4000)

/** 回到桌面 → 切「流程管控」→ 等气泡渲染 */
async function openFlowTab() {
  await send('Page.navigate', { url: UI + '/#/dashboard' })
  await sleep(2000)
  for (let i = 0; i < 30; i++) {
    const clicked = await ev(`(() => {
      const t = [...document.querySelectorAll('.mod-tab')].find(e => e.innerText.trim() === '流程管控')
      if (!t) return false
      t.click(); return true
    })()`)
    if (clicked) break
    await sleep(500)
  }
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.flow-board .fb-chip')`)) return
    await sleep(500)
  }
}

await openFlowTab()
const chips = await ev(`[...document.querySelectorAll('.fb-chip .fb-chip-name')].map(e => e.innerText.trim())`)
console.log('气泡清单 =', JSON.stringify(chips || []))

for (const [name, expect] of Object.entries(EXPECT)) {
  if (!(chips || []).includes(name)) {
    console.log(`\n[${name}] 当前实例没有这个卡点(值为 0 不显示)—— 跳过`)
    continue
  }
  console.log(`\n[${name}] 点击 → 期望 ${expect.hash}`)
  await openFlowTab()
  const clicked = await ev(`(() => {
    const b = [...document.querySelectorAll('.fb-chip')].find(e => e.querySelector('.fb-chip-name')?.innerText.trim() === ${JSON.stringify(name)})
    if (!b) return false
    b.click(); return true
  })()`)
  ok(clicked, '气泡可点')
  await sleep(2500)
  const hash = await ev(`location.hash`)
  const hasRoot = await ev(`!!document.querySelector(${JSON.stringify(expect.root)})`)
  ok(String(hash || '').includes(expect.hash), `落点 ${hash}`)
  ok(hasRoot, `目标页面根节点 ${expect.root} 在(不是空白面板壳)`)
  // 反证:页面级面板绝不能再落到 /panelx/list/<code>
  const code = { 订单待结转: 'ORDER_CONVERT', 待排产工单: 'SCHEDULE_BOARD', '工单未排产(行)': 'WORK_ORDER_LIST', 产成品入库待审核: 'FINISH_IN' }[name]
  if (!['产成品入库待审核'].includes(name)) {
    ok(!String(hash || '').includes(`/panelx/list/${code}`), `没落到 /panelx/list/${code}`)
  }
}

await ev(`localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
try { edge.kill() } catch { /* ignore */ }
console.log(`\n== 结果: ${pass} 通过 / ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
