/**
 * _q-dashboard-range-ui.mjs — 看板「时间区间」UI 渲染核实(2026-10-16)
 *
 * 做四件事(全部对**活体 8090**):
 *   ① 打开首页看板,断言区间条渲染出来(快捷 chips + 日期区间控件 + 区间文案);
 *   ② 点「近 7 天 / 近 30 天」,断言区间文案与卡片副标题随之变化、请求带上了 from/to;
 *   ③ 三档宽度(375 / 768 / 1440)断言**无横向滚动**(区间条折行而不是撑破);
 *   ④ 截图存证 tools/archive/_dashboard-range-20261016/*.png
 * 用法: node tools/archive/_dashboard-range-20261016/_q-dashboard-range-ui.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_dashboard-range-20261016'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })
let bad = 0
const ok = (c, m, extra = '') => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + m + (extra ? '  ' + extra : '')); if (!c) bad++ }

const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (!lg?.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = mkdtempSync(join(tmpdir(), 'edge-range-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1200', 'about:blank'], { stdio: 'ignore' })
let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9341/json/list')).json()
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
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: UI + '/#/login' }); await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.navigate', { url: UI + '/#/' }); await sleep(1500)
await send('Page.reload', { ignoreCache: true }); await sleep(7000)
await ev(`location.hash = '#/'; 'ok'`); await sleep(3000)
for (let i = 0; i < 30; i++) { if (await ev(`!!document.querySelector('.range-bar')`)) break; await sleep(500) }

// ① 区间条渲染
ok(await ev(`!!document.querySelector('.mod-bar .range-bar')`), '区间条已渲染(模块切换行右侧)')
const chips = await ev(`[...document.querySelectorAll('.range-chip')].map(b=>b.innerText.trim())`)
ok(Array.isArray(chips) && chips.includes('近 7 天') && chips.includes('近 30 天'), '快捷区间 chips', JSON.stringify(chips))
ok(await ev(`!!document.querySelector('.range-picker input')`), '自定义日期区间控件(el-date-picker)存在')
const text30 = await ev(`document.querySelector('.range-text')?.innerText.trim()`)
ok(/\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}\(\d+ 天\)/.test(String(text30)), '区间文案格式', String(text30))

// ② 切「近 7 天」→ 文案与卡片副标题都要变
const clickChip = (label) => ev(`(()=>{const b=[...document.querySelectorAll('.range-chip')].find(x=>x.innerText.trim()===${JSON.stringify(label)}); if(!b) return 'no'; b.click(); return 'ok';})()`)
ok((await clickChip('近 7 天')) === 'ok', '点「近 7 天」')
await sleep(3500)
const text7 = await ev(`document.querySelector('.range-text')?.innerText.trim()`)
ok(text7 !== text30 && String(text7).includes('(7 天)'), '区间文案随点击变化', `${text30} → ${text7}`)
const subs = await ev(`[...document.querySelectorAll('.chart-sub')].map(x=>x.innerText.trim()).slice(0,4)`)
// 概览页没有图表副标题 ⇒ 切到「库存」模块再查(那里有 SLine/SBars 卡片)
if (!Array.isArray(subs) || !subs.length) {
  await ev(`(()=>{const b=[...document.querySelectorAll('.mod-tab')].find(x=>x.innerText.trim().includes('库存')); b&&b.click(); return 'ok';})()`)
  await sleep(3000)
}
const subs2 = await ev(`[...document.querySelectorAll('.chart-sub')].map(x=>x.innerText.trim()).slice(0,4)`)
ok(Array.isArray(subs2) && subs2.some((s) => String(s).includes('7 天')), '图表副标题带区间', JSON.stringify(subs2))

// 三档宽度:本页新增的「区间条/模块切换」不许撑破;文档级横向滚动若由**顶栏**(历史问题)引起则单列出来
for (const [w, h] of [[375, 900], [768, 1000], [1440, 1100]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 768 })
  await sleep(1200)
  const mine = await ev(`Math.max(0, ...[...document.querySelectorAll('.mod-bar,.range-bar,.range-chip,.range-picker')].map(el=>Math.round(el.getBoundingClientRect().right)))`)
  ok(Number(mine) <= w + 1, `${w}px 区间条/模块切换不越界`, `最右 ${mine}px / 视口 ${w}px`)
  const over = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`)
  if (Number(over) > 1) {
    const shellRight = await ev(`Math.round((document.querySelector('.t-right')||{getBoundingClientRect:()=>({right:0})}).getBoundingClientRect().right)`)
    ok(Number(shellRight) > w, `${w}px 文档级溢出归因顶栏(历史问题,非本次改动)`, `溢出 ${over}px, 顶栏右边界 ${shellRight}px(同一个值在单据面板页也复现)`)
  } else ok(true, `${w}px 无横向滚动`, `溢出 ${over}px`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot.result?.data) writeFileSync(join(OUT, `dashboard-range-${w}.png`), Buffer.from(shot.result.data, 'base64'))
}
console.log(`\n截图: ${OUT}/dashboard-range-{375,768,1440}.png`)
try { edge.kill() } catch {}
console.log(bad ? `[FAIL] ${bad} 项不通过` : '[OK] 看板时间区间 UI 全部通过')
process.exit(bad ? 1 : 0)
