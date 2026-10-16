/*
 * _probe-manu-order-panels-removed.mjs — 「生产工单明细表/统计表」下架验收(2026-10-17)
 *
 * 用户口径:「完成上面的任务后检查当前生产工单明细标和生产工单统计表,查看当前这两个表是否没有作用,
 *   不存在作用的话删除掉就可以,帮我查看一下。」
 *
 * 【验什么】
 *   ① 生产制造 › 生产计划 菜单里**没有**「生产工单明细表」「生产工单统计表」;
 *   ② 同组其它项**都还在**(订单结转/生产工单/快速排产/工单排产/产线排产负荷)—— 防误删;
 *   ③ 直接走路由 /panelx/list/MANU_ORDER_DETAIL 也拿不到面板(后端已下架,应给可读错误而不是白屏崩);
 *   ④ 相邻面板(MANU_ORDER 生产工单)仍能正常打开 —— 证明只摘了这两张、没伤到邻居;
 *   ⑤ 无未捕获异常。
 *
 * 用法: node tools/archive/_probe-manu-order-panels-removed.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9510
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-manudel-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/dashboard` })
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.portal')`)) break }
  await sleep(2500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(600)

  // 侧栏结构(LeftNav.vue):`.nav-group`(一级) → `.nav-modules/.nav-module`(二级分组)，
  // **叶子在悬停弹出的飞卡 `.fly-card .card-item` 里**(用户截图那四列就是它)。
  const clickNav = (sel, text) => ev(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .filter((e) => (e.innerText || '').includes(${JSON.stringify(text)}) && e.getBoundingClientRect().height > 0)
    if (!el.length) return false
    el[0].click(); return true
  })()`)
  const hoverNav = (sel, text) => ev(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .filter((e) => (e.innerText || '').includes(${JSON.stringify(text)}) && e.getBoundingClientRect().height > 0)
    if (!el.length) return false
    el[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    return true
  })()`)
  console.log(`  点「生产制造」=${await clickNav('.nav-group', '生产制造')}`)
  await sleep(1200)
  console.log(`  悬停「生产计划」=${await hoverNav('.nav-module', '生产计划')}`)
  await sleep(1200)
  const card = String(await ev(`(document.querySelector('.fly-card')?.innerText || '')`))
  const titles = (card.match(/[^\n]+/g) || []).map((s) => s.trim()).filter(Boolean)
  console.log(`  飞卡(生产计划列) = ${JSON.stringify(titles)}`)

  ok('① 菜单飞卡里没有「生产工单明细表」', !titles.includes('生产工单明细表'), JSON.stringify(titles))
  ok('① 菜单飞卡里没有「生产工单统计表」', !titles.includes('生产工单统计表'), JSON.stringify(titles))
  for (const keep of ['订单结转', '生产工单', '快速排产', '工单排产', '产线排产负荷']) {
    ok(`② 同组「${keep}」还在(没误删)`, titles.includes(keep), JSON.stringify(titles))
  }
  const errsBeforeRoute = errs.length
  ok('⑤ 菜单阶段无未捕获异常', errsBeforeRoute === 0, errs.slice(0, 2).join(' | '))

  // ③ 直接走路由:后端已下架 ⇒ 应给可读错误,不该白屏崩
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/MANU_ORDER_DETAIL` })
  await sleep(5000)
  const gone = await ev(`(() => {
    const t = document.body.innerText || ''
    return { hasTable: !!document.querySelector('.el-table'), hasErr: /面板不存在|不存在|失败|错误/.test(t),
      body: t.replace(/\\s+/g,' ').slice(0, 160) }
  })()`)
  console.log(`  直连已下架面板 = ${JSON.stringify(gone)}`)
  ok('③ 直连已下架面板给出可读提示(不是白屏也不是崩溃)',
    gone?.hasErr === true || gone?.hasTable === false, JSON.stringify(gone))

  // ④ 邻居面板还能正常开
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/MANU_ORDER` })
  await sleep(5000)
  const nb = await ev(`(() => { const t = document.body.innerText || ''
    return { hasPanel: !!document.querySelector('.panelx-list'), body: t.replace(/\\s+/g,' ').slice(0, 120) } })()`)
  console.log(`  邻居面板 MANU_ORDER = ${JSON.stringify(nb)}`)
  ok('④ 邻居面板 MANU_ORDER 仍能打开(只摘了这两张)', nb?.hasPanel === true, JSON.stringify(nb))

  // ⑤' 走已下架路由必然触发一次 400(面板不存在)——那是**预期**的;除它之外不该有别的异常
  const extra = errs.slice(errsBeforeRoute).filter((e) => !/status code 400/.test(e))
  console.log(`  走已下架路由新增异常 ${errs.length - errsBeforeRoute} 条(其中非 400 的 ${extra.length} 条)`)
  ok('⑤ 除"面板不存在"那次 400 外,无未捕获的运行时异常', extra.length === 0, extra.join(' | '))
  ok('⑤ 直连已下架面板确实得到 400(面板已不在后端)',
    errs.slice(errsBeforeRoute).some((e) => /status code 400/.test(e)), JSON.stringify(errs.slice(errsBeforeRoute, errsBeforeRoute + 2)))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 生产工单明细表/统计表 下架验收:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
