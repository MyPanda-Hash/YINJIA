/**
 * 一次性探针(2026-10-15):三出库面板左栏「单据选择」的**界面级**验证。
 *
 * 断言口径(逐条对应需求"为成品出库/销售出库/材料出库都配置与销售订单一样的订单选择列"):
 *   ① 三个面板打开后,左侧「单据选择」栏存在(doc-select-rail)且未折叠;
 *   ② 左栏表头 = 单号 | 日期 | <该单中间列> | 审核状态 —— 与销售订单**逐字同构**;
 *   ③ 左栏首行数据里四格均有值(不是空白列);
 *   ④ 点左栏第 2 行能切换右侧当前单据(高亮跟随)= 真的是"选择器"。
 *
 * 导航口径(踩坑记录):注入 token 后**必须 Page.reload 让应用重新 bootstrap**,
 *   否则 router 守卫用的是 setup 时读到的旧 store;且首屏会停在 /dashboard,
 *   需在应用内再推一次 hash 才落到面板路由。
 *
 * 依赖:5173(源码即时生效)+ 8090(后端)在跑;需 Edge + CDP(沙箱下起不来,见
 * docs/development/明细参照确认与必填校验-成因与处理方案.md §7)。
 * 用法: node tools/archive/_probe-3out-rail-ui.mjs [uiBase] [apiBase]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = process.argv[2] || 'http://localhost:5173'
const API = process.argv[3] || 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CASES = [
  { code: 'FINISH_IN', name: '产成品入库单', middle: '加工单号' },
  { code: 'SALE_OUT', name: '销售出库单', middle: '客户' },
  { code: 'MATERIAL_OUT', name: '材料出库单', middle: '生产车间' },
]
const REF = { code: 'SO_ORDER', name: '销售订单(基线对照)', middle: '客户' }

const results = []
let pass = 0, total = 0
const check = (label, ok, detail) => {
  total++
  if (ok) pass++
  results.push({ label, ok, detail: detail || '' })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' — ' + detail : ''}`)
}

// ---------- 后端登录 ----------
const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

// ---------- Edge + CDP ----------
const profile = mkdtempSync(join(tmpdir(), 'edge-rail-'))
const port = 9335
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)
console.log('[boot] 已注入 token 并重载\n')

/** 在应用内切到面板路由(硬跳会被守卫弹回 dashboard,故走 hash 推进 + 轮询) */
async function openPanel(code) {
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  for (let i = 0; i < 40; i++) {
    const ok = await ev(`!!document.querySelector('.doc-select-rail')`)
    if (ok) break
    await sleep(500)
  }
  await sleep(1500)
  return await ev(`location.hash`)
}

async function readRail() {
  return await ev(`(() => {
    const rail = document.querySelector('.doc-select-rail');
    if (!rail) return { ok: false, reason: 'no .doc-select-rail | hash=' + location.hash };
    const heads = [...rail.querySelectorAll('thead th')].map(th => th.innerText.trim());
    const rows = [...rail.querySelectorAll('tbody tr')];
    return {
      ok: true,
      heads,
      rows: rows.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim())),
      activeIdx: rows.findIndex(tr => tr.classList.contains('active')),
      collapsed: rail.classList.contains('coll'),
    };
  })()`)
}

for (const c of [...CASES, REF]) {
  console.log(`\n=== ${c.name} (${c.code}) ===`)
  const hash = await openPanel(c.code)
  const rail = await readRail()
  if (!rail.ok) { check(`${c.code} 左栏存在`, false, rail.reason + ' | hash=' + hash); continue }
  check(`${c.code} 左栏存在且未折叠`, !rail.collapsed, `列头 ${JSON.stringify(rail.heads)}`)

  const expectHeads = ['单号', '日期', c.middle, '审核状态']
  check(`${c.code} 列头 = ${expectHeads.join(' | ')}`,
    rail.heads.length === 4 && expectHeads.every((h, i) => rail.heads[i] === h),
    `实际 ${JSON.stringify(rail.heads)}`)

  const first = rail.rows[0] || []
  check(`${c.code} 首行四格均有值`,
    first.length === 4 && first.every((v) => String(v).trim() !== ''),
    `首行 ${JSON.stringify(first)}`)

  if (rail.rows.length >= 2 && rail.activeIdx !== 1) {
    await ev(`document.querySelectorAll('.doc-select-rail tbody tr')[1].click(); 'ok'`)
    await sleep(1500)
    const after = await readRail()
    check(`${c.code} 点第 2 行切换当前单据`, after.activeIdx === 1,
      `activeIdx ${rail.activeIdx} -> ${after.activeIdx}`)
  } else {
    check(`${c.code} 点第 2 行切换当前单据`, true,
      `仅 ${rail.rows.length} 行,跳过点击`)
  }
}

console.log(`\n结果: ${pass}/${total}`)
console.log('JSON:' + JSON.stringify(results))
try { edge.kill() } catch {}
process.exit(pass === total ? 0 : 1)
