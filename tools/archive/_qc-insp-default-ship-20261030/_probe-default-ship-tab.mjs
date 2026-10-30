/*
 * _probe-default-ship-tab.mjs — 「检验项目/检验方案」弹窗默认进入「出货检验计划」页签(2026-10-30)
 *
 * 用户口径(截图):「把当前这个出货检验计划的页签放在默认进入的第一个」。
 * 实现:QcInspPlanDialog.load() 里 panel 开了 shipSource ⇒ source='ship' + loadShip()。
 *
 * 断言(只读,不点保存):
 *   ① 制程检验单(QC_PROC_INSP)新建空白草稿 → 打开弹窗:来源切换**默认选中「出货检验计划」**,
 *      产品编码空 ⇒ 0 行 + 「先在表头填写后再取计划」提示,且不发 fromShipPlan;
 *   ② 表头填产品编码 C-23-11 后重开弹窗:仍默认「出货检验计划」,**自动**发 fromShipPlan 并带出 10 行,
 *      抬头自动显示计划单号(不用手点来源);
 *   ③ 用户切到「检验标准库」后关闭再打开:来源**复位回「出货检验计划」**(默认优先,不记忆上次);
 *   ④ 组装成品检验单(QC_ASM_INSP)弹窗同样默认「出货检验计划」;
 *   ⑤ 没开这个来源的面板(首件 QC_FIRST_INSP)不出现来源切换、不请求 fromShipPlan(不串数据);
 *   ⑥ 全程无未捕获运行时异常。
 *
 * 用法:node tools/archive/_qc-insp-default-ship-20261030/_probe-default-ship-tab.mjs [base]
 *      默认 http://localhost:5173(源码即时生效);传 http://127.0.0.1:8090 验 jar 内前端。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const API = 'http://127.0.0.1:8090'
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const CODE = 'C-23-11'          // 正式账套里有出货检验计划(IP-2026-10-0008,10 行)的产品
const OUT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-defship-'))
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
    await sleep(800)
  }
  /** 弹窗快照:来源按钮的选中态、表格行、空提示、计划单号 */
  const snapDialog = () => ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    if (!d) return { found: false }
    const txt = (d.innerText || '').replace(/\\s+/g, ' ')
    const rows = [...d.querySelectorAll('.el-table__body .el-table__row')]
      .map((r) => [...r.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean))
      .filter((r) => r.length)
    return {
      found: true,
      radios: [...d.querySelectorAll('.el-radio-button')].map((e) => ({
        text: (e.innerText || '').trim(),
        active: e.className.includes('is-active'),
      })),
      hasPlanNo: txt.includes('计划单号'),
      emptyText: (d.querySelector('.el-table__empty-text') || {}).innerText || '',
      rows, txt: txt.slice(0, 260),
    }
  })()`)
  const activeRadio = (d) => (d.radios || []).find((r) => r.active)?.text || ''
  const openDialog = async () => {
    const opened = await clickAction('检验项目/检验方案')
    await sleep(2500)
    return opened
  }
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
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    const f = path.join(OUT_DIR, name)
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
    console.log('  [SHOT] ' + f)
  }

  // ── ① 制程检验单:空白草稿 → 弹窗默认来源 = 出货检验计划 ──────────
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
  await waitPanel()
  const clickedNew = await clickAction('新增')
  await sleep(2000)
  await setProductCode('')
  await sleep(600)
  reqs = []
  const opened1 = await openDialog()
  let d = await snapDialog()
  console.log(`  新建=${clickedNew} 弹窗=${d.found} 来源=${JSON.stringify(d.radios)} 行数=${(d.rows || []).length}`)
  ok('① 制程检验单弹窗打开了', opened1 && d.found)
  ok('① 默认选中「出货检验计划」', activeRadio(d) === '出货检验计划', `active=${activeRadio(d)}`)
  ok('① 产品编码空 ⇒ 0 行计划数据', (d.rows || []).length === 0, `rows=${(d.rows || []).length}`)
  ok('① 产品编码空 ⇒ 显示「先在表头填写后再取计划」', (d.emptyText || '').includes('先在表头填写后再取计划'), JSON.stringify(d.emptyText))
  ok('① 产品编码空 ⇒ 不发 fromShipPlan', reqs.length === 0, JSON.stringify(reqs))
  await shot('01-default-ship-empty-code.png')
  await closeDialog()

  // ── ② 填产品编码 → 重开:仍默认出货计划,自动取数 ────────────────
  const typed = await setProductCode(CODE)
  await sleep(800)
  reqs = []
  await openDialog()
  await sleep(1200)
  d = await snapDialog()
  console.log(`  产品编码=${JSON.stringify(typed)} 请求=${JSON.stringify(reqs)} 行数=${(d.rows || []).length} 计划单号=${d.hasPlanNo}`)
  ok('② 填了产品编码重开 ⇒ 仍默认「出货检验计划」', activeRadio(d) === '出货检验计划', `active=${activeRadio(d)}`)
  ok('② 打开即自动请求 fromShipPlan(带产品编码)', reqs.some((u) => u.includes(`productCode=${CODE}`)), JSON.stringify(reqs))
  ok('② 自动带出计划行(10 行)', (d.rows || []).length === 10, `rows=${(d.rows || []).length}`)
  ok('② 自动显示计划单号(无需手点来源)', d.hasPlanNo === true, d.txt.slice(0, 200))
  await shot('02-default-ship-with-plan.png')

  // ── ③ 切到标准库 → 关闭重开:复位回出货计划 ────────────────────
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const r = [...d.querySelectorAll('.el-radio-button')].find((e) => (e.innerText || '').trim() === '检验标准库')
    if (r) { r.querySelector('.el-radio-button__inner').click(); return 'ok' }
    return 'no'
  })()`)
  await sleep(1200)
  d = await snapDialog()
  ok('③ 手动切到「检验标准库」生效', activeRadio(d) === '检验标准库', `active=${activeRadio(d)}`)
  await closeDialog()
  await openDialog()
  await sleep(800)
  d = await snapDialog()
  ok('③ 关掉重开 ⇒ 来源复位回「出货检验计划」', activeRadio(d) === '出货检验计划', `active=${activeRadio(d)}`)
  await closeDialog()

  // ── ④ 组装成品检验单:弹窗同样默认出货计划 ─────────────────────
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_ASM_INSP` })
  await waitPanel()
  await clickAction('新增')
  await sleep(2000)
  const opened4 = await openDialog()
  d = await snapDialog()
  console.log(`  组装成品检验弹窗=${d.found} 来源=${JSON.stringify(d.radios)}`)
  ok('④ 组装成品检验单弹窗打开了', opened4 && d.found)
  ok('④ 默认选中「出货检验计划」', activeRadio(d) === '出货检验计划', `active=${activeRadio(d)}`)
  await shot('03-asm-insp-default-ship.png')
  await closeDialog()

  // ── ⑤ 没开这个来源的面板(首件检验单):入口按口径已移除 ⇒ 不可能串计划数据 ──
  reqs = []
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  await waitPanel()
  await clickAction('新增')
  await sleep(2000)
  const opened5 = await openDialog()
  d = await snapDialog()
  console.log(`  首件检验单 入口可点=${opened5} 弹窗=${d.found} 请求=${JSON.stringify(reqs)}`)
  ok('⑤ 首件检验单无「检验项目/检验方案」入口(2026-10-16 已移除) ⇒ 弹窗打不开', opened5 === false && !d.found)
  ok('⑤ 不请求 fromShipPlan(无跨面板串数据的入口)', reqs.length === 0, JSON.stringify(reqs))

  ok('⑥ 全程无未捕获运行时异常', errs.length === 0, JSON.stringify(errs.slice(0, 3)))
  console.log(`\n结果: ${pass} PASS / ${fail} FAIL`)
  process.exitCode = fail ? 1 : 0
} finally {
  try { ws?.close() } catch { /* ignore */ }
  try { edge.kill() } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
