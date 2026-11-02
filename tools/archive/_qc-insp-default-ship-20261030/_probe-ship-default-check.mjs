/*
 * _probe-ship-default-check.mjs — 「取出货检验计划」默认勾选/默认带入(2026-10-30)
 *
 * 用户口径:
 *   · 组装成品检验(QC_ASM_INSP):出货检验计划里**外观/尺寸/重量 三项默认勾选**,其余默认不勾;
 *     点「取出货检验计划」只带这三类(不再整张计划全量)。
 *   · 制程检验(QC_PROC_INSP):反过来,这三类**默认不勾**,其余(性能/功能性…)默认勾选。
 *   规则本体 = frontend/src/core/qc/shipPlanDefaults.js(单测见同目录 shipPlanDefaults.test.js);
 *   本探针验 UI 接线:弹窗默认勾选态 + 工具栏按钮带入行数。
 *
 * 断言(只读:改的都是页面内草稿,不点保存;每段用完直接整页刷新丢弃):
 *   ① 制程检验(C-23-11,计划 10 行)弹窗:默认勾选 7 行,勾上的都不是 外观/尺寸/重量,那三类都没勾;
 *   ② 制程「取出货检验计划」按钮:带入 7/10 行(不再全量);
 *   ③ 组装成品检验(C-23-11)弹窗:默认勾选 3 行(外观+2 个尺寸),其余不勾;
 *   ④ 组装成品「取出货检验计划」按钮:带入 3/10 行;
 *   ⑤ 换产品 B-92-25(计划 15 行):成品默认勾选 6 行(外观1+尺寸3+重量2),性能类不勾;
 *   ⑥ 全程无未捕获运行时异常。
 *
 * 用法:node tools/archive/_qc-insp-default-ship-20261030/_probe-ship-default-check.mjs [base]
 *      默认 http://localhost:5173;传 http://127.0.0.1:8090 验 jar 内前端。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const API = 'http://127.0.0.1:8090'
const PORT = 9500
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shipdef-'))
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
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  const waitPanel = async () => {
    for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
    await sleep(2500)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(500)
  }
  const clickAction = async (label) => {
    const direct = await ev(`(() => {
      const btn = [...document.querySelectorAll('.as-side-btn, .panelx-list button, .panelx-list .tb-main, .panelx-list .tb-menu .ctx-item, .qr-band-act2')]
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
  const openDialog = async () => { await clickAction('检验项目/检验方案'); await sleep(2800) }
  const closeDialog = async () => {
    await ev(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
      if (!d) return 'none'
      const b = [...d.querySelectorAll('.el-dialog__footer button')].find((x) => (x.innerText || '').trim() === '取消')
      if (b) { b.click(); return 'cancel' }
      const x = d.querySelector('.el-dialog__headerbtn'); if (x) { x.click(); return 'x' }
      return 'none'
    })()`)
    await sleep(900)
  }
  /** 弹窗快照:来源选中态 / 表格行(文本+是否勾选)/ 页脚已选数 */
  const snapDialog = () => ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    if (!d) return { found: false }
    const rows = [...d.querySelectorAll('.el-table__body .el-table__row')].map((r) => ({
      text: [...r.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' | '),
      checked: !!r.querySelector('td .el-checkbox.is-checked'),
    })).filter((r) => r.text)
    const countText = (d.querySelector('.qcplan-count') || {}).innerText || ''
    const active = [...d.querySelectorAll('.el-radio-button')].find((e) => e.className.includes('is-active'))
    return { found: true, active: active ? (active.innerText || '').trim() : '', rows, countText: countText.replace(/\\s+/g, ' ').trim() }
  })()`)
  const toast = () => ev(`[...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').trim()).join(' | ')`)
  const setSheetCode = (val) => ev(`(() => {
    const inputs = [...document.querySelectorAll('.qr-grid tbody tr:first-child td.c-fixed input')]
    const inp = inputs[1]
    if (!inp) return { ok: false, n: inputs.length }
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, ${JSON.stringify(val)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, now: inp.value }
  })()`)
  /** 通用单据页表头字段(如 产品编码) = .header-fields 里 label 同名的 .field 内的 input */
  const setHeaderField = (label, val) => ev(`(() => {
    const lab = [...document.querySelectorAll('.header-fields label, .fields.header-fields label')]
      .find((l) => (l.textContent || '').trim() === ${JSON.stringify(label)})
    if (!lab) return { ok: false, reason: 'label not found' }
    const inp = lab.closest('.field')?.querySelector('input')
    if (!inp) return { ok: false, reason: 'input not found' }
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, ${JSON.stringify(val)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, now: inp.value }
  })()`)
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(r.result.data, 'base64'))
  }
  const reload = async (panel) => {
    await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${panel}` })
    await waitPanel()
  }
  const isPhys = (t) => /外观|尺寸|重量/.test(t)
  const summarize = (d) => d.rows.filter((r) => r.checked).map((r) => r.text)

  // ══ ① 制程检验:默认勾选 = 三类以外(C-23-11 计划 10 行 → 7 行) ══
  await reload('QC_PROC_INSP')
  await clickAction('新增')
  await sleep(2200)
  const typed = await setSheetCode('C-23-11')
  await sleep(700)
  await openDialog()
  let d = await snapDialog()
  const procChecked = summarize(d)
  console.log(`  ① 制程 产品编码=${JSON.stringify(typed)} 来源=${d.active} 行=${d.rows.length} 勾选=${d.rows.filter((r) => r.checked).length} 页脚=${d.countText}`)
  console.log(`     勾上的: ${JSON.stringify(procChecked)}`)
  ok('① 制程弹窗默认「出货检验计划」页签 + 计划 10 行', d.found && d.active === '出货检验计划' && d.rows.length === 10)
  ok('① 制程默认勾选 7 行(三类以外的全部)', d.rows.filter((r) => r.checked).length === 7, `checked=${d.rows.filter((r) => r.checked).length}`)
  ok('① 制程默认勾上的都不是 外观/尺寸/重量', procChecked.every((t) => !isPhys(t)), JSON.stringify(procChecked))
  ok('① 制程三个实物类检验项默认不勾', d.rows.filter((r) => isPhys(r.text)).every((r) => !r.checked))
  ok('① 页脚显示「已选 7 项」', /已选\s*7\s*项/.test(d.countText), d.countText)
  await shot('04-proc-default-check.png')
  await closeDialog()

  // ══ ② 制程「取出货检验计划」:只带默认勾选的 7/10 ══
  await clickAction('取出货检验计划')
  await sleep(1200)
  let msg = await toast()
  console.log(`  ② 制程按钮提示: ${msg}`)
  ok('② 制程「取出货检验计划」带入 7/10 行(不再全量)', /带入\s*7\/10\s*行/.test(msg), msg)

  // ══ ③ 组装成品检验(C-23-11):默认勾选 = 外观/尺寸/重量(C-23-11 无重量行 → 3 行) ══
  await reload('QC_ASM_INSP')
  const asmNew = await clickAction('新增')
  await sleep(2600)
  const setHead1 = await setHeaderField('产品编码', 'C-23-11')
  await sleep(700)
  await openDialog()
  d = await snapDialog()
  let asmChecked = summarize(d)
  console.log(`  ③ 成品 新建=${asmNew} 表头=${JSON.stringify(setHead1)} 来源=${d.active} 行=${d.rows.length} 勾选=${d.rows.filter((r) => r.checked).length} 页脚=${d.countText}`)
  console.log(`     勾上的: ${JSON.stringify(asmChecked)}`)
  ok('③ 成品弹窗默认「出货检验计划」页签 + 计划 10 行', d.found && d.active === '出货检验计划' && d.rows.length === 10)
  ok('③ 成品默认勾选 3 行(外观+2 个尺寸;C-23-11 计划无重量行)', d.rows.filter((r) => r.checked).length === 3, `checked=${d.rows.filter((r) => r.checked).length}`)
  ok('③ 成品勾上的全是 外观/尺寸/重量', asmChecked.every((t) => isPhys(t)), JSON.stringify(asmChecked))
  ok('③ 成品性能类检验项默认不勾', d.rows.filter((r) => /跌落强度|流速|压降|黑水|余氯|卫生安全/.test(r.text)).every((r) => !r.checked))
  ok('③ 页脚显示「已选 3 项」', /已选\s*3\s*项/.test(d.countText), d.countText)
  await shot('05-asm-default-check.png')
  await closeDialog()

  // ══ ④ 成品「取出货检验计划」:只带默认勾选的 3/10 ══
  await clickAction('取出货检验计划')
  await sleep(1200)
  msg = await toast()
  console.log(`  ④ 成品按钮提示: ${msg}`)
  ok('④ 成品「取出货检验计划」带入 3/10 行', /带入\s*3\/10\s*行/.test(msg), msg)
  await shot('07-asm-after-import.png')
  // 明细第一列「检验类型」应是 外观/尺寸/出货重量(计划「检验内容」为空时按项目名判类)
  const asmDetail = await ev(`(() => {
    const tables = [...document.querySelectorAll('.panelx-list .el-table')].filter((t) => !t.closest('.el-dialog'))
    const hit = tables.find((t) => (t.innerText || '').includes('检验类型'))
    if (!hit) return { found: false }
    return {
      found: true,
      rows: [...hit.querySelectorAll('.el-table__body .el-table__row')]
        .map((r) => (r.innerText || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean),
    }
  })()`)
  console.log(`  ④ 成品明细 ${JSON.stringify(asmDetail).slice(0, 400)}`)
  ok('④ 带入后明细「检验类型」= 外观/尺寸(不是空/「检验项目」占位)',
    asmDetail.found && asmDetail.rows.length >= 3
      && asmDetail.rows.every((t) => !/^检验项目\\s/.test(t))
      && asmDetail.rows.some((t) => t.includes('外观')) && asmDetail.rows.some((t) => t.includes('尺寸')),
    JSON.stringify(asmDetail).slice(0, 300))

  // ══ ⑤ 换产品 B-92-25(15 行,含 重量/出货重量):成品默认勾选 6 行 ══
  const setHead2 = await setHeaderField('产品编码', 'B-92-25')
  await sleep(700)
  await openDialog()
  d = await snapDialog()
  asmChecked = summarize(d)
  console.log(`  ⑤ 成品 表头=${JSON.stringify(setHead2)} 行=${d.rows.length} 勾选=${d.rows.filter((r) => r.checked).length} 页脚=${d.countText}`)
  console.log(`     勾上的: ${JSON.stringify(asmChecked)}`)
  ok('⑤ B-92-25 计划 15 行、默认勾选 6 行(外观1+尺寸3+重量2)', d.rows.length === 15 && d.rows.filter((r) => r.checked).length === 6, `rows=${d.rows.length} checked=${d.rows.filter((r) => r.checked).length}`)
  ok('⑤ 勾上的含 重量/出货重量 行', asmChecked.some((t) => t.includes('重量')), JSON.stringify(asmChecked))
  ok('⑤ 页脚显示「已选 6 项」', /已选\s*6\s*项/.test(d.countText), d.countText)
  await shot('06-asm-default-check-b9225.png')
  await closeDialog()

  ok('⑥ 全程无未捕获运行时异常', errs.length === 0, JSON.stringify(errs.slice(0, 3)))
  console.log(`\n结果: ${pass} PASS / ${fail} FAIL`)
  process.exitCode = fail ? 1 : 0
} finally {
  try { ws?.close() } catch { /* ignore */ }
  try { edge.kill() } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
