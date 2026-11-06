/**
 * verify-range-print.mjs —— 验证「排单计划」只印 N 天(默认 3,可设置)(2026-11-05 客户口径)
 *
 * 客户原话:「打印的就是打印的时候显示 3 天或者是 3 天 4 天,这样子我们自己可以去设置。」
 * ⇒ 日期列 = 勾选行最早日期起 N 天;N 由「排单计划」右侧小设置按钮配置(默认 3,1~10)。
 *
 * 做法(CDP,对着 8090 现役构建跑):
 *   1. 登录 → 工单排产 → 选「2号车间」→ 全选 → 打桩 window.print → 点「排单计划」→ 读打印层:
 *      日期列 = **3 列**(默认)、行数 = 勾选数、标题/二维码照旧、「客户等级」列已隐藏;
 *   2. 点右侧设置按钮 → 弹窗里把默认天数改成 5 → 保存 → 再打一次 ⇒ 日期列 = **5 列**;
 *   3. 只勾一行 ⇒ 日期列仍是 3 列(从该行最早日期起)。
 *
 * 用法: node verify-range-print.mjs [base]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LINE = '2号车间'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const BTN_JS = `(() => [...document.querySelectorAll('button')].find(b => (b.innerText || '').replace(/\\s+/g,'').startsWith('排单计划')))()`

const LAYER_JS = `(() => {
  const host = document.getElementById('yj-print-host')
  const trs = host ? [...host.querySelectorAll('tbody tr')] : []
  const ths = host ? [...host.querySelectorAll('thead th')].map(t => (t.innerText||'').trim()) : []
  return JSON.stringify({
    printed: window.__printed || 0,
    title: document.title,
    n: trs.length,
    heads: ths,
    rows: trs.map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim())),
    qrCss: (() => { const img = host && host.querySelector('td.qr img'); return img ? getComputedStyle(img).width : '' })(),
  })
})()`
const isDateHead = (h) => /^\d{1,2}\/\d{1,2}$/.test(h) || /^\d{1,2}月\d{1,2}日$/.test(h)

const s = await launch({ port: 9490 })
let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? '  ' + extra : ''))
  ok ? pass++ : fail++
}
const selLine = (line) => `(() => {
  const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === ${JSON.stringify(line)})
  if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
})()`
const pickAll = `(() => {
  const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
  let n = 0
  for (const tr of rows) { const box = tr.querySelector('td:first-child .el-checkbox'); if (box) { (box.querySelector('input') || box).click(); n++ } }
  window.print = function () { window.__printed = (window.__printed || 0) + 1 }
  return n
})()`

try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login', 2000); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4500)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 3000); await sleep(9000)
  console.log('选线', await s.evaluate(selLine(LINE))); await sleep(7000)

  // ── 场景 1:默认只印 3 天 ──
  const picked1 = await s.evaluate(pickAll); await sleep(900)
  console.log('勾选行数 =', picked1)
  console.log('点「排单计划」=', await s.evaluate(`(() => { const b = ${BTN_JS}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(3500)
  const L1 = JSON.parse(await s.evaluate(LAYER_JS))
  const d1 = L1.heads.filter(isDateHead)
  console.log('日期列 =', JSON.stringify(d1), '| 行数 =', L1.n, '| 表头 =', JSON.stringify(L1.heads))
  check('默认打印 3 天(日期列 = 3)', d1.length === 3, 'dateCols=' + d1.length)
  check('打印层行数 = 勾选张数', L1.n === picked1, 'rows=' + L1.n)
  check('标题仍是「…车间排单计划」', /排单计划$/.test(L1.title), L1.title)
  check('客户等级列全空 ⇒ 已隐藏', !L1.heads.includes('客户等级'), JSON.stringify(L1.heads.slice(0, 3)))
  check('二维码照常出纸(按物理尺寸)', L1.qrCss === '52px', 'qr=' + L1.qrCss)
  const png1 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-print-3days.png', import.meta.url), Buffer.from(png1.result.data, 'base64'))
  console.log('[written] shot-print-3days.png')

  // ── 场景 2:通过右侧设置按钮改成 5 天,再打 ⇒ 5 列 ──
  console.log('点设置按钮 =', await s.evaluate(`(() => { const b = document.querySelector('.wb-print-set'); if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(1200)
  const dlg = JSON.parse(await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => (x.innerText||'').includes('排单计划打印设置'))
    const inp = d && d.querySelector('.el-input-number input')
    return JSON.stringify({ open: !!d, title: d ? (d.querySelector('.el-dialog__title')||{}).innerText : '', days: inp ? inp.value : null })
  })()`))
  console.log('设置弹窗 =', JSON.stringify(dlg))
  check('右侧小设置按钮能打开「排单计划打印设置」', dlg.open === true, JSON.stringify(dlg.title))
  check('弹窗里默认天数 = 3', String(dlg.days) === '3', 'days=' + dlg.days)
  await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => (x.innerText||'').includes('排单计划打印设置'))
    const inp = d && d.querySelector('.el-input-number input')
    if (!inp) return 'no-input'
    const set = (el, v) => { el.focus(); const dd = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); dd && dd.set ? dd.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    set(inp, '5')
    inp.dispatchEvent(new Event('blur', { bubbles: true }))
    const btn = [...d.querySelectorAll('button')].find(b => (b.innerText||'').trim() === '保存')
    if (btn) btn.click()
    return 'saved'
  })()`); await sleep(1500)
  console.log('再点「排单计划」=', await s.evaluate(`(() => { const b = ${BTN_JS}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(3500)
  const L2 = JSON.parse(await s.evaluate(LAYER_JS))
  const d2 = L2.heads.filter(isDateHead)
  console.log('设置 5 天后日期列 =', JSON.stringify(d2))
  check('设置 5 天后打印 5 天(日期列 = 5)', d2.length === 5, 'dateCols=' + d2.length)
  check('日期列从原最早日期接着往后排', d2[0] === d1[0], `${d2[0]} vs ${d1[0]}`)
  const png2 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-print-5days.png', import.meta.url), Buffer.from(png2.result.data, 'base64'))
  console.log('[written] shot-print-5days.png')

  // ── 场景 3:单行 ⇒ 仍 3 列(从该行最早日期起)──
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 2500); await sleep(7000)
  await s.evaluate(selLine(LINE)); await sleep(6500)
  await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    if (rows[0]) { const box = rows[0].querySelector('td:first-child .el-checkbox'); if (box) (box.querySelector('input') || box).click() }
    window.print = function () { window.__printed = (window.__printed || 0) + 1 }
    return 'ok'
  })()`); await sleep(800)
  await s.evaluate(`(() => { const b = ${BTN_JS}; if (b) b.click(); return 'ok' })()`); await sleep(3200)
  const L3 = JSON.parse(await s.evaluate(LAYER_JS))
  const d3 = L3.heads.filter(isDateHead)
  console.log('单行日期列 =', JSON.stringify(d3), '行数 =', L3.n)
  // 前面把默认天数改成了 5(存 localStorage)⇒ 单行也应继续按 5 天(顺带验证设置持久生效)
  check('设置 5 天持久生效:单行也按 5 天出纸', d3.length === 5 && L3.n === 1, `cols=${d3.length}, rows=${L3.n}`)

  if (s.logs.length) console.log('页面错误日志:', s.logs.slice(0, 5))
  console.log('RESULT:', fail === 0 ? 'PASS' : 'FAIL', `(pass=${pass}, fail=${fail})`)
  process.exitCode = fail === 0 ? 0 : 1
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
