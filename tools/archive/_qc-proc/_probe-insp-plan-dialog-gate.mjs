/*
 * _probe-insp-plan-dialog-gate.mjs — 「检验项目/检验方案」弹窗的出货检验计划来源:填了产品编码才给数
 *
 * 验(只读,全程不点保存):2026-10-18 报障「制程检验单没填产品编号却获取到了出货检验计划的数据」。
 *   根因 = 所有面板共用同一个 PanelxList 实例(PortalLayout 的 keep-alive),弹窗里的来源/计划行是
 *   组件内存状态,换面板后 `source` 还停在 'ship' 且上一次的计划行还在 ⇒ 新单顶着「产品编码（表头未填）」
 *   显示上一张单的计划。修复见 QcInspPlanDialog.shipMode / load() 与 PanelxList SHIP_PLAN_SOURCE_PANELS。
 *
 * 断言:
 *   ① 制程检验单(QC_PROC_INSP)弹窗**有**来源切换(检验标准库 / 出货检验计划);
 *   ② 未填产品编码 ⇒ 切到该来源后 **0 行**、只有「本单还没填产品编码」提示、**不发** fromShipPlan 请求;
 *   ③ 填了产品编码 ⇒ 才发请求且带出计划行(IP-TEST-0001 的 4 行),「带入明细」把
 *      检验要求/检验方法 写进本单纸张表;
 *   ④ 换到**没开**这个来源的面板(切炭检验单 QC_CUT_INSP)⇒ 弹窗没有来源切换条、没有计划单号,
 *      也没有上一次的计划行(跨面板不串数据);
 *   ⑤ 全程无未捕获运行时异常。
 *
 * 前置:C-84-02 的出货检验计划夹具 = tools/archive/_qc-proc/seed-rd-insp-plan-test.sql(两账套均已执行)。
 * 用法:node tools/archive/_qc-proc/_probe-insp-plan-dialog-gate.mjs [base]   默认 http://localhost:5173
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const API = 'http://127.0.0.1:8090'
const PORT = 9497
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const CODE = 'C-84-02'          // 有计划 IP-TEST-0001(4 行)的产品
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败(测试账套 YJ_TEST)'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-plangate-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []; let reqs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    if (m.method === 'Network.requestWillBeSent' && String(m.params.request?.url || '').includes('fromShipPlan')) {
      reqs.push(m.params.request.url)
    }
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  // ── 通用页面小工具 ──────────────────────────────────────────────
  const waitPanel = async () => {
    for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
    await sleep(2500)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(500)
  }
  /** 工具栏动作:检验项目/检验方案(右侧「单据操作」条的 .as-side-btn / 面板按钮 / 「更多」下拉里)。返回是否点到 */
  const clickAction = async (label) => {
    const direct = await ev(`(() => {
      const btn = [...document.querySelectorAll('.as-side-btn, .panelx-list button, .panelx-list .tb-menu .ctx-item, .qr-band-act2')]
        .find((e) => (e.innerText || '').trim() === ${JSON.stringify(label)})
      if (!btn) return false
      btn.click(); return true
    })()`)
    if (direct) return true
    await ev(`(() => { [...document.querySelectorAll('.panelx-list .tb-caret')].forEach((c) => c.click()); return 'ok' })()`)
    await sleep(500)
    return await ev(`(() => {
      const el = [...document.querySelectorAll('.panelx-list .tb-menu .ctx-item')].find((e) => (e.innerText || '').trim() === ${JSON.stringify(label)})
      if (!el) return false
      el.click(); return true
    })()`)
  }
  const closeDialog = async () => {
    await ev(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
      if (!d) return 'none'
      const b = [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.innerText || '').trim() === '取消')
      if (b) { b.click(); return 'cancel' }
      const x = d.querySelector('.el-dialog__headerbtn'); if (x) { x.click(); return 'x' }
      return 'none'
    })()`)
    await sleep(600)
  }
  /** 弹窗快照:来源切换条、计划单号、行、空提示、页脚 */
  const snapDialog = () => ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    if (!d) return { found: false, radios: [], rows: [], txt: '', hasPlanNo: false, hasVersion: false, emptyText: '' }
    const txt = (d.innerText || '').replace(/\\s+/g, ' ')
    const rows = [...d.querySelectorAll('.el-table__body .el-table__row')]
      .map((r) => [...r.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean))
      .filter((r) => r.length)
    return {
      found: true,
      radios: [...d.querySelectorAll('.el-radio-button__inner')].map((e) => (e.innerText || '').trim()),
      hasPlanNo: txt.includes('计划单号'),
      hasVersion: txt.includes('版本号'),
      emptyText: (d.querySelector('.el-table__empty-text') || {}).innerText || '',
      rows, txt: txt.slice(0, 300),
    }
  })()`)
  const openDialog = async () => {
    const opened = await clickAction('检验项目/检验方案')
    await sleep(2200)
    return opened
  }
  /** 纸张表(制程检验单)抬头「产品编码」输入框 = .qr-grid tbody 首行第 2 个有 input 的 td */
  const setProductCode = (val) => ev(`(() => {
    const inputs = [...document.querySelectorAll('.qr-grid tbody tr:first-child td.c-fixed input')]
    const inp = inputs[1]
    if (!inp) return { ok: false, n: inputs.length }
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, ${JSON.stringify(val)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, now: inp.value }
  })()`)

  // ── ① 制程检验单:新建一张空草稿(产品编码空) ─────────────────────
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
  await waitPanel()
  const clickedNew = await clickAction('新增')
  await sleep(2000)
  const blank = await setProductCode('')     // 双保险:即便是既有单也先清空抬头产品编码
  console.log(`  新建=${clickedNew} 清空产品编码=${JSON.stringify(blank)}`)
  await sleep(600)

  const opened1 = await openDialog()
  let d = await snapDialog()
  console.log(`  ① 弹窗=${d.found} 来源切换=${JSON.stringify(d.radios)}`)
  ok('① 制程检验单弹窗打开了', opened1 && d.found)
  ok('① 制程检验单弹窗**有**来源切换(检验标准库 / 出货检验计划)',
    d.found && d.radios.includes('检验标准库') && d.radios.includes('出货检验计划'), JSON.stringify(d.radios))

  // ── ② 未填产品编码:切到出货检验计划 ⇒ 不发请求、0 行、只有提示 ────
  reqs = []
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const r = [...d.querySelectorAll('.el-radio-button__inner')].find((e) => (e.innerText || '').trim() === '出货检验计划')
    if (r) r.click(); return 'ok'
  })()`)
  await sleep(2500)
  d = await snapDialog()
  console.log(`  ② 抬头=${JSON.stringify((d.txt || '').slice(0, 120))}`)
  console.log(`  ② 行数=${d.rows.length} 空提示=${JSON.stringify(d.emptyText)} 计划单号=${d.hasPlanNo}`)
  ok('② 空产品编码 ⇒ 一行计划数据都不显示', d.found && d.rows.length === 0, `rows=${d.rows.length}`)
  ok('② 空产品编码 ⇒ 显示「本单还没填产品编码，先在表头填写后再取计划」',
    (d.emptyText || '').includes('先在表头填写后再取计划'), JSON.stringify(d.emptyText))
  ok('② 空产品编码 ⇒ 没有计划单号/版本号', !d.hasPlanNo && !d.hasVersion, d.txt.slice(0, 160))
  ok('② 空产品编码 ⇒ **不发** fromShipPlan 请求', reqs.length === 0, JSON.stringify(reqs))
  const refreshDisabled = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const b = [...d.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '刷新')
    return b ? b.disabled : null
  })()`)
  ok('② 空产品编码 ⇒ 「刷新」不可点(取不到数就不会去取)', refreshDisabled === true, `disabled=${refreshDisabled}`)
  await closeDialog()

  // ── ③ 填了产品编码:才取数,且「带入明细」把要求/方法写进纸张表 ──
  const typed = await setProductCode(CODE)
  console.log(`  ③ 填入产品编码=${JSON.stringify(typed)}`)
  await sleep(600)
  reqs = []
  await openDialog()
  await sleep(2000)
  d = await snapDialog()
  if (d.found && !d.rows.length && d.radios.includes('出货检验计划')) {   // 弹窗默认回标准库时再点一次
    await ev(`(() => {
      const x = [...document.querySelectorAll('.el-dialog')].find((y) => (y.innerText || '').includes('检验项目/检验方案'))
      const r = [...x.querySelectorAll('.el-radio-button__inner')].find((e) => (e.innerText || '').trim() === '出货检验计划')
      if (r) r.click(); return 'ok'
    })()`)
    await sleep(2500)
    d = await snapDialog()
  }
  console.log(`  ③ 请求=${JSON.stringify(reqs)} 行数=${d.rows.length} 计划单号=${d.hasPlanNo}`)
  ok('③ 填了产品编码 ⇒ 才请求 fromShipPlan(且带上该编码)', reqs.some((u) => u.includes(`productCode=${CODE}`)), JSON.stringify(reqs))
  ok('③ 取到计划 IP-TEST-0001 的 4 行', d.rows.length === 4, `rows=${d.rows.length}`)
  ok('③ 抬头显示计划单号/版本号', d.hasPlanNo && d.hasVersion, d.txt.slice(0, 200))

  // 勾选全部 → 带入明细 → 纸张表里能看到计划的 检验要求/检验方法
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const cb = d.querySelector('.el-table__header .el-checkbox')
    if (cb) cb.click(); return 'ok'
  })()`)
  await sleep(700)
  const canCarry = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const b = [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.innerText || '').trim() === '带入明细')
    return b ? { has: true, disabled: b.disabled } : { has: false }
  })()`)
  ok('③ 勾选后「带入明细」可用', canCarry.has && canCarry.disabled === false, JSON.stringify(canCarry))
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const b = [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.innerText || '').trim() === '带入明细')
    if (b) b.click(); return 'ok'
  })()`)
  await sleep(2500)
  const sheet = await ev(`(() => {
    const g = document.querySelector('.panelx-list .qr-grid')
    if (!g) return { text: '', vals: [] }
    // 纸张表里 检验要求/检验方法 是 el-input / textarea ⇒ innerText 读不到,必须读控件的 value
    const vals = [...g.querySelectorAll('tbody tr')]
      .map((tr) => [...tr.querySelectorAll('input, textarea')].map((i) => i.value).filter(Boolean).join(' | '))
      .filter(Boolean)
    return { text: (g.innerText || '').replace(/\\s+/g, ' '), vals }
  })()`)
  const flat = JSON.stringify(sheet.vals)
  console.log(`  ③ 纸张表行值=${flat.slice(0, 400)}`)
  // 注:这张纸面(QcProcInspSheet 纵向表)只渲染 检验要求/检验方法 两格,「检验项目」是行的身份键
  //     (列表页/报表用),纸面上看不见 ⇒ 基准取"恰好 4 行 + 计划里那 4 条检验要求一字不差"。
  ok('③ 带入后纸张表恰好 4 行,且 4 条检验要求与计划一一对应',
    ['外观均匀完好', '44.5±0.5', '＞200克', '≥98%'].every((k) => flat.includes(k)) && sheet.vals.length === 4,
    `rows=${sheet.vals.length} ${flat.slice(0, 300)}`)
  ok('③ 带入后带上计划「控制标准及要求」→ 检验要求',
    flat.includes('外观均匀完好') || flat.includes('44.5±0.5'), flat.slice(0, 300))
  ok('③ 带入后带上计划「控制方法」→ 检验方法', flat.includes('目视') && flat.includes('游标卡尺'), flat.slice(0, 300))

  // ── ④ 换到没开这个来源的面板(切炭检验单):不串数据 ──────────────
  await ev(`location.hash = '#/panelx/list/QC_CUT_INSP'`)
  await waitPanel()
  const opened4 = await openDialog()
  const d4 = await snapDialog()
  console.log(`  ④ 切炭弹窗=${d4.found} 来源切换=${JSON.stringify(d4.radios)}`)
  console.log(`  ④ 抬头=${JSON.stringify((d4.txt || '').slice(0, 140))}`)
  ok('④ 切炭检验单弹窗打开', opened4 && d4.found)
  ok('④ 没开该来源的面板 ⇒ 弹窗没有来源切换条', d4.found && d4.radios.length === 0, JSON.stringify(d4.radios))
  ok('④ 没开该来源的面板 ⇒ 没有计划单号/版本号(上一个面板的计划不串过来)',
    d4.found && !d4.hasPlanNo && !d4.hasVersion, (d4.txt || '').slice(0, 160))
  // 出货检验计划那块表**整块没渲染**:来源提示语与它独有的「不合格应对措施」列都不该出现
  // (标准库那张项目表列名是 项目编码/项目名称/检验标准…,没有这一列)
  ok('④ 没开该来源的面板 ⇒ 出货检验计划那块(提示语 + 不合格应对措施列)整块不渲染',
    d4.found && !(d4.txt || '').includes('下面列出本单产品对应的《出货检验计划表》')
    && !(d4.txt || '').includes('不合格应对措施'), (d4.txt || '').slice(0, 200))
  ok('④ 没开该来源的面板 ⇒ 走的是标准库分支(出现方案/项目两张表)',
    (d4.txt || '').includes('检验方案') && (d4.txt || '').includes('检验项目'), (d4.txt || '').slice(0, 200))

  // ── ⑤ 报障原路径:先在**开这个来源**的面板(成品检验单)切到它,再换到没开的面板 ──────
  //   旧代码的坑:`source` 是组件内存状态,面板共用同一个实例 ⇒ 换面板后它仍停在 'ship',
  //   新面板(dialog 的 shipSource=false)照样把出货检验计划那块连同上次的行渲染出来。
  await ev(`location.hash = '#/panelx/list/QC_ASM_INSP'`)
  await waitPanel()
  await closeDialog()
  // 成品检验单的抬头是自定义纸张表(.field = label + input):把产品编码写成有计划的那个,
  // 顺带回归「组装成品检验单的来源②仍然能取到 4 行」这条原有链路(2026-10-17 那批的验收点)。
  const asmCode = await ev(`(() => {
    for (const f of document.querySelectorAll('.panelx-list .field')) {
      const lb = f.querySelector('label')
      if (!lb || (lb.innerText || '').trim() !== '产品编码') continue
      const inp = f.querySelector('input')
      if (!inp) continue
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(inp, ${JSON.stringify(CODE)})
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return { ok: true, now: inp.value }
    }
    return { ok: false }
  })()`)
  console.log(`  ⑤ 成品检验单产品编码写入=${JSON.stringify(asmCode)}`)
  await sleep(600)
  await openDialog()
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const r = [...d.querySelectorAll('.el-radio-button__inner')].find((e) => (e.innerText || '').trim() === '出货检验计划')
    if (r) r.click(); return 'ok'
  })()`)
  await sleep(3000)
  const asm = await snapDialog()
  console.log(`  ⑤ 成品检验单弹窗 来源切换=${JSON.stringify(asm.radios)} 计划行=${asm.rows.length} 计划单号=${asm.hasPlanNo}`)
  ok('⑤ 成品检验单弹窗也有来源切换条', asm.found && asm.radios.includes('出货检验计划'), JSON.stringify(asm.radios))
  ok('⑤ 回归:成品检验单按产品编码仍取到计划的 4 行(原有链路没被改坏)',
    asm.rows.length === 4 && asm.hasPlanNo, `rows=${asm.rows.length} ${(asm.txt || '').slice(0, 120)}`)
  await closeDialog()
  await ev(`location.hash = '#/panelx/list/QC_CUT_INSP'`)
  await waitPanel()
  await openDialog()
  const d5 = await snapDialog()
  console.log(`  ⑤ 换到切炭检验单后 来源切换=${JSON.stringify(d5.radios)} 抬头=${JSON.stringify((d5.txt || '').slice(0, 90))}`)
  ok('⑤ 从「成品检验单」换到没开该来源的面板 ⇒ 弹窗退回标准库(无来源切换条)',
    d5.found && d5.radios.length === 0, JSON.stringify(d5.radios))
  ok('⑤ 报障路径不复现:不再顶着「产品编码（表头未填）」显示出货检验计划那块',
    d5.found && !(d5.txt || '').includes('下面列出本单产品对应的《出货检验计划表》')
    && !(d5.txt || '').includes('计划单号'), (d5.txt || '').slice(0, 160))
  await closeDialog()

  ok('⑤ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
  ok('⑤ 全程未发出任何一次「空产品编码」的取计划请求',
    !reqs.some((u) => /productCode=(&|$)/.test(u)), JSON.stringify(reqs))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 检验项目/检验方案·出货检验计划来源门禁:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
