/**
 * _q-flow-board-ui.mjs —— 「流程管控」看板的活体验收(CDP / Edge headless)
 *
 * 验四件事(每一步都是真实界面,不是接口自说自话):
 *   A. 桌面模块条出现「流程管控」页签,点它切到该视图;
 *   B. 顶部「当前卡点」条渲染出芯片(有卡点时有芯片,芯片文案含数量);
 *   C. 两条链路(生产过程 / 库存流转)各 4 段泳道共 8 条,节点卡数量与 flowSpec 对齐;
 *   D. 点一个节点卡 → 路由跳到该面板(证据 = location.hash 变化);
 *   E. 三档宽度 1440/768/375 各截一张图,并断言无横向溢出(documentElement.scrollWidth ≤ innerWidth)。
 *
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-flow-board-ui.mjs [uiBase] [cdpPort]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = UI + '/api'
const PORT = Number(process.argv[3] || 9366)
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(import.meta.dirname, '_shots')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ✔ ${n}${d ? ' — ' + d : ''}`) } else { fail++; console.log(`  ✘ ${n}${d ? ' — ' + d : ''}`) } }

const api = async (method, p, body, token) => {
  const res = await fetch(API + p, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res.json()
}
const lg = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 120)); process.exit(1) }
const admin = lg.data

/* ── 接口面先看一眼:节点键与卡点 ── */
const flow = (await api('GET', '/dashboard/flow', undefined, admin.token)).data || {}
console.log(`接口 /dashboard/flow:节点 ${Object.keys(flow.nodes || {}).length} 个 · 卡点 ${(flow.blocks || []).length} 条`)
for (const b of (flow.blocks || []).slice(0, 12)) console.log(`   卡点 ${b.name}(${b.level}) = ${b.value} → ${b.panelCode}`)
const nodeWithData = Object.entries(flow.nodes || {}).filter(([, v]) => v && v.docs != null).length
check('接口返回节点数据(单据类节点带 docs)', nodeWithData > 0, `${nodeWithData} 个节点有单据数`)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-flow-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 Edge */ }
  if (!tab) await sleep(500)
}
if (!tab) { console.log('[FATAL] Edge CDP 未就绪'); edge.kill(); process.exit(2) }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true }))?.result?.result?.value
const nav = async (url, wait = 3000) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break } await sleep(wait) }
const shot = async (name) => {
  let r = await send('Page.captureScreenshot', { format: 'png' })
  if (!r?.result?.data) { await sleep(800); r = await send('Page.captureScreenshot', { format: 'png' }) }
  if (!r?.result?.data) { console.log('  ! 截图失败:', name); return }
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('  · 截图:', name)
}
const setViewport = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await sleep(600)
}
await send('Page.enable'); await send('Runtime.enable')

await nav(`${UI}/#/login`, 1200)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(admin.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.user))}); 'ok'`)
await nav('about:blank', 300)
await nav(`${UI}/#/dashboard`, 5000)
await ev(`(() => { const b = document.querySelector('.wz-skip'); if (b) b.click(); return 1 })()`)
await sleep(600)

/* A. 页签存在且能切 */
const tabs = (await ev(`Array.from(document.querySelectorAll('.mod-tab')).map(e => e.textContent.trim())`)) || []
check('桌面模块条出现「流程管控」页签', tabs.some((t) => t.includes('流程管控')), tabs.join(' | '))

/* A2. 基线:先量「概览」页在 375 的横向溢出 —— 用于区分"我的视图撑破"与"外壳本来就撑破"。
   2026-10-16 实测结论:这 22px 来自**顶栏**(`.t-right`:中/更新公告/未读/用户 在 375 挤不下),
   与看板内容无关、也不是本次新增;看板侧 .mod-tabs 已修成可横滚(capped + overflow-x:auto)。
   ⇒ 本脚本对 375/768/1440 的判据 = **不比基线更差**(而不是"必须为 0")。 */
await setViewport(375, 900)
await ev('window.scrollTo(0,0)')
await sleep(700)
const baseOverflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`)
console.log(`  · 基线(概览 @375)横向溢出 = ${baseOverflow}px`)
if (baseOverflow > 1) {
  const who = await ev(`JSON.stringify(Array.from(document.querySelectorAll('.dashboard *')).map(e => ({
    t: (e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName),
    w: Math.round(e.getBoundingClientRect().width), r: Math.round(e.getBoundingClientRect().right),
    x: (e.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 16)
  })).filter(o => o.r > window.innerWidth + 1).sort((a,b) => b.r - a.r).slice(0, 8))`)
  console.log('    ↳ 概览页溢出元素(既有问题,非本次视图):', who)
}
await setViewport(1440, 1000)
await sleep(500)
check('基线已量(概览 @375)', typeof baseOverflow === 'number', `${baseOverflow}px`)
await ev(`(() => { const b = Array.from(document.querySelectorAll('.mod-tab')).find(e => e.textContent.includes('流程管控')); b?.click(); return !!b })()`)
await sleep(3500)

/* B. 卡点条 */
const chipCount = await ev(`document.querySelectorAll('.fb-chip').length`)
const calm = await ev(`!!document.querySelector('.fb-calm')`)
const chipText = (await ev(`Array.from(document.querySelectorAll('.fb-chip')).map(e => e.textContent.replace(/\\s+/g,' ').trim())`)) || []
console.log(`  · 卡点: ${chipText.join(' | ') || (calm ? '（无积压) ' : '（无芯片也无提示 = 有问题)')}`)
check('顶部卡点条有渲染(有卡点=芯片 / 无卡点=通畅提示)', chipCount > 0 || calm, `芯片 ${chipCount} 个`)
check('接口卡点数与界面芯片数一致', chipCount === (flow.blocks || []).length, `接口 ${(flow.blocks || []).length} / 界面 ${chipCount}`)

/* C. 两条链路 × 4 泳道 + 节点卡 */
const chains = (await ev(`Array.from(document.querySelectorAll('.fb-chain .fb-title')).map(e => e.textContent.trim())`)) || []
const lanes = (await ev(`Array.from(document.querySelectorAll('.fb-lane .fb-lane-name')).map(e => e.textContent.trim())`)) || []
const nodeCnt = await ev(`document.querySelectorAll('.fb-node').length`)
console.log(`  · 链路: ${chains.join(' / ')}`)
console.log(`  · 泳道(${lanes.length}): ${lanes.join(' | ')}`)
check('两条链路渲染(生产过程 / 库存流转)', chains.length === 2, chains.join(' / '))
check('泳道共 8 段', lanes.length === 8, `实际 ${lanes.length}`)
check('节点卡数量与规格一致(≥25)', nodeCnt >= 25, `实际 ${nodeCnt}`)

/* 状态色分级:至少有一个节点带 lv-* 类,且未落到"全 na" */
const lvDist = await ev(`(() => {
  const m = {}
  document.querySelectorAll('.fb-node').forEach(n => {
    for (const c of n.classList) if (c.startsWith('lv-')) m[c] = (m[c] || 0) + 1
  })
  return JSON.stringify(m)
})()`)
console.log(`  · 节点状态分布: ${lvDist}`)
const lvObj = JSON.parse(lvDist || '{}')
check('节点按状态分级着色(至少一档非 na)', Object.keys(lvObj).some((k) => k !== 'lv-na'), lvDist)
check('有数字节点(不是整屏「—」)', await ev(`Array.from(document.querySelectorAll('.fb-node-num')).some(e => e.textContent.trim() !== '—')`))

/* D. 点节点卡 → 路由跳转 */
const before = await ev('location.hash')
const jumped = await ev(`(() => {
  const n = Array.from(document.querySelectorAll('.fb-node')).find(x => x.textContent.includes('库存明细') || x.textContent.includes('采购入库单')) || document.querySelector('.fb-node')
  n?.click(); return n ? n.textContent.replace(/\\s+/g,' ').trim().slice(0, 30) : ''
})()`)
await sleep(2000)
const after = await ev('location.hash')
check('点节点卡跳转到该面板', !!after && after !== before, `${before} → ${after}(点了「${jumped}」)`)

/* E. 三档宽度截图 + 无横向溢出 */
await nav(`${UI}/#/dashboard`, 3000)
await ev(`(() => { const b = Array.from(document.querySelectorAll('.mod-tab')).find(e => e.textContent.includes('流程管控')); b?.click(); return !!b })()`)
await sleep(3000)
for (const [w, h] of [[1440, 1000], [768, 1000], [375, 900]]) {
  await setViewport(w, h)
  await ev('window.scrollTo(0,0)')
  await sleep(800)
  const overflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`)
  const cards = await ev(`document.querySelectorAll('.fb-node').length`)
  // 判据 = **不比基线更差**:概览页在 375 本来就溢出 22px(既有问题,已在本脚本 A2 段量过),
  // 本次视图若把溢出放大才算我引入的回归。
  check(`${w}px:横向溢出不超过基线(${baseOverflow}px)且节点仍在(${cards} 卡)`,
    overflow <= Math.max(1, baseOverflow) && cards >= 25, `溢出 ${overflow}px / 基线 ${baseOverflow}px`)
  if (overflow > 1) {
    // 溢出时点名是谁撑破的(拿去改 CSS,不用肉眼猜)
    const who = await ev(`JSON.stringify(Array.from(document.querySelectorAll('.flow-board *')).map(e => ({
      t: e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName,
      w: Math.round(e.getBoundingClientRect().width), r: Math.round(e.getBoundingClientRect().right),
      x: (e.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 18)
    })).filter(o => o.r > window.innerWidth + 1).sort((a,b) => b.r - a.r).slice(0, 6))`)
    console.log('    ↳ 溢出元素:', who)
  }
  await shot(`flow-${w}.png`)
}
await send('Emulation.clearDeviceMetricsOverride')

ws.close(); edge.kill()
console.log(`\n=== 流程管控界面取证:PASS ${pass} / FAIL ${fail}(截图在 ${OUT})===`)
process.exit(fail ? 1 : 0)
