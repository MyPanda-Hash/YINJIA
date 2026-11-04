/**
 * verify-range-print.mjs —— 验证「排单计划」日期列 = 勾选行最前→最后(2026-11-04 用户口径)
 *
 * 用户口径:「当前想法是打印的就按这些勾选的表中最前面的日期到最后的一个日期就行」。
 *
 * 做法(CDP,对着 5173 源码实例跑;后端用 8090 现役 jar,/planSheet 接口本轮未改):
 *   1. 登录 → 工单排产页 → 选「2号车间」(未完工 4 张);
 *   2. 打桩 window.print → 勾选全部 4 行 → 点「排单计划」→ 读页面内打印层:
 *      - 日期列表头 = 10/29 … 11/7(最前→最后,共 10 列;**不再从今天 11-04 起**);
 *      - 0227 行的 10-29/30/31 三格 = 2000(历史量照印,旧实现这三格全空);
 *      - 行数 = 4、标题照旧、window.print 只调 1 次;
 *   3. 只勾 0227 一行再打一次:日期列收窄成 10月29日~10月31日(3 列、M月D日 写法);
 *   4. 截图落 shot-range-print.png。
 *
 * 用法: node verify-range-print.mjs [base]   (默认 http://localhost:5173)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://localhost:5173'
const LINE = '2号车间'

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号'), 'admin'); set(ph('登录密码'), '123456')
  const btn = document.querySelector('.login-submit') || [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('进入系统'))
  if (!btn) return 'no-button'; btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9482 })
let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? '  ' + extra : ''))
  ok ? pass++ : fail++
}
const BTN_JS = `(() => [...document.querySelectorAll('button')].find(b => (b.innerText || '').replace(/\\s+/g,'').startsWith('排单计划')))()`

/** 读页面内打印层 */
const LAYER_JS = `(() => {
  const host = document.getElementById('yj-print-host')
  const trs = host ? [...host.querySelectorAll('tbody tr')] : []
  const ths = host ? [...host.querySelectorAll('thead th')].map(t => (t.innerText||'').trim()) : []
  return JSON.stringify({
    printed: window.__printed || 0,
    hasLayer: !!host,
    title: document.title,
    n: trs.length,
    heads: ths,
    qrCss: (() => { const img = host && host.querySelector('td.qr img'); return img ? getComputedStyle(img).width : '' })(),
    pgs: host ? host.querySelectorAll('.pg').length : 0,
    pageSubs: host ? [...host.querySelectorAll('.hd-sub')].map((x) => (x.innerText || '').trim()) : [],
    rows: trs.map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim())),
  })
})()`

try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login', 2000); await sleep(2500)
  console.log('登录', await s.evaluate(LOGIN_JS)); await sleep(4500)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 3000); await sleep(9000)

  console.log('选线', await s.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === ${JSON.stringify(LINE)})
    if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`))
  await sleep(7000)

  const rowNos = JSON.parse(await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    return JSON.stringify(rows.map(tr => { const c = [...tr.querySelectorAll('td')].map(td => (td.innerText||'').trim()); return c[1] }))
  })()`))
  console.log('该线工单号 =', JSON.stringify(rowNos))

  // 勾全部 4 行
  console.log('勾选 =', await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    let n = 0
    for (const tr of rows) { const box = tr.querySelector('td:first-child .el-checkbox'); if (box) { (box.querySelector('input') || box).click(); n++ } }
    return JSON.stringify({ clicked: n })
  })()`))
  await sleep(1000)

  // 打桩 print,保留打印层
  await s.evaluate(`(() => { window.print = function () { window.__printed = (window.__printed || 0) + 1 }; return 'ok' })()`)
  console.log('点按钮(4行) =', await s.evaluate(`(() => { const b = ${BTN_JS}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(3500)

  const L1 = JSON.parse(await s.evaluate(LAYER_JS))
  const dateHeads1 = L1.heads.filter((h) => /^\d{1,2}\/\d{1,2}$/.test(h) || /月.*日$/.test(h))
  console.log('打印层表头 =', JSON.stringify(L1.heads))
  const expectN = rowNos.length
  console.log('日期列 =', JSON.stringify(dateHeads1), '行数 =', L1.n, '二维码宽 =', L1.qrCss)
  check('点一次按钮调用 window.print 1 次', L1.printed === 1, 'printed=' + L1.printed)
  check('打印层行数 = 勾选张数 ' + expectN, L1.n === expectN, 'rows=' + L1.n)
  check('标题仍是 成型车间排单计划', L1.title === '成型车间排单计划', L1.title)
  check('日期列 = 10 列(勾选行最前 10-29 → 最后 11-07),不再从今天 11-04 起', dateHeads1.length === 10, JSON.stringify(dateHeads1))
  check('首列是 10/29(历史日期照印)', dateHeads1[0] === '10/29', String(dateHeads1[0]))
  check('末列是 11/7(最后一天)', dateHeads1[dateHeads1.length - 1] === '11/7', String(dateHeads1.at(-1)))
  const r0227 = L1.rows.find((r) => JSON.stringify(r).includes('GD-2026-10-0227'))
  const planCells = r0227 ? r0227.slice(r0227.findIndex((v) => v === '0' || v === '') , r0227.length) : []
  // 0227 行的日期格(日期列紧跟在固定列后面):直接按日期列起点断言更稳 —— 表头里第一个日期列的下标
  const firstDateIdx = L1.heads.findIndex((h) => h === '10/29')
  const cells0227 = r0227 ? r0227.slice(firstDateIdx, firstDateIdx + 10) : []
  console.log('0227 日期格 =', JSON.stringify(cells0227))
  check('0227 历史三格 2000/2000/2000 照印(旧实现全空)', cells0227.slice(0, 3).join(',') === '2000,2000,2000', cells0227.slice(0, 3).join(','))
  // 2026-11-04 用户口径「二维码太小」:行少时二维码 60px(≈15.9mm),不再跟列数缩成 28px
  check('二维码按物理尺寸放大(行少 ⇒ 60px ≈15.9mm)', L1.qrCss === '60px', 'qr=' + L1.qrCss)

  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-range-print-all4.png', import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-range-print-all4.png')

  // 场景 2:只勾 0227 一行 → 3 列 M月D日
  await s.evaluate(`(() => { const b = ${BTN_JS}; return 'ok' })()`)
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 2500); await sleep(7000)
  console.log('重进后选线', await s.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === ${JSON.stringify(LINE)})
    if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`)); await sleep(6500)
  await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    const tr = rows.find(x => (x.innerText || '').includes('GD-2026-10-0227'))
    const box = tr && tr.querySelector('td:first-child .el-checkbox')
    if (box) (box.querySelector('input') || box).click()
    window.print = function () { window.__printed = (window.__printed || 0) + 1 }
    return 'ok'
  })()`); await sleep(800)
  console.log('点按钮(单行 0227) =', await s.evaluate(`(() => { const b = ${BTN_JS}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(3000)
  const L2 = JSON.parse(await s.evaluate(LAYER_JS))
  const dateHeads2 = L2.heads.filter((h) => /^\d{1,2}\/\d{1,2}$/.test(h) || /月.*日$/.test(h))
  console.log('单行日期列 =', JSON.stringify(dateHeads2), '行数 =', L2.n)
  check('单行 0227:日期列收窄成 3 列 10月29日~10月31日', JSON.stringify(dateHeads2) === JSON.stringify(['10月29日', '10月30日', '10月31日']), JSON.stringify(dateHeads2))
  check('单行 0227:行数 = 1', L2.n === 1, 'rows=' + L2.n)

  const png2 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-range-print-one.png', import.meta.url), Buffer.from(png2.result.data, 'base64'))
  console.log('[written] shot-range-print-one.png')


  // ── 场景 3:1号机 16 天 ⇒ A4 横向自动拆页(每页 8 天,页眉标「第 x/2 页 · 日期区间」)──
  await s.navigate(BASE + '/#/prod/plan/workOrderBoard', 2500); await sleep(7000)
  console.log('场景3 选线', await s.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.wb-line')].find(x => ((x.querySelector('.wb-line-name') || {}).innerText || '').trim() === '1号机')
    if (!hit) return 'no-node'; (hit.querySelector('.wb-line-name') || hit).click(); return 'clicked'
  })()`)); await sleep(6500)
  const n3 = await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-block .el-table__body tbody tr, .wb-block .el-table__body-wrapper tbody tr')]
    let n = 0
    for (const tr of rows) { const box = tr.querySelector('td:first-child .el-checkbox'); if (box) { (box.querySelector('input') || box).click(); n++ } }
    window.print = function () { window.__printed = (window.__printed || 0) + 1 }
    return n
  })()`); await sleep(900)
  console.log('场景3 勾选行数 =', n3)
  console.log('场景3 点按钮 =', await s.evaluate(`(() => { const b = ${BTN_JS}; if (!b) return 'no-button'; b.click(); return 'clicked' })()`))
  await sleep(3500)
  const L3 = JSON.parse(await s.evaluate(LAYER_JS))
  const dateHeads3 = L3.heads.filter((h) => /^\d{1,2}\/\d{1,2}$/.test(h))
  console.log('场景3 分页数 =', L3.pgs, '| 页眉 =', JSON.stringify(L3.pageSubs), '| 日期列 =', dateHeads3.length)
  check('1号机 16 天 ⇒ 自动拆成 2 页', L3.pgs === 2, 'pgs=' + L3.pgs)
  check('每页页眉标页码 + 日期区间', (L3.pageSubs || []).length === 2 && /第 1\/2 页 · 10月20日~10月27日/.test(L3.pageSubs[0]), JSON.stringify(L3.pageSubs))
  check('两页合计 16 个日期列（一个不丢）', dateHeads3.length === 16, 'dateCols=' + dateHeads3.length)
  check('每页都带二维码列（哪页都能扫）', (L3.heads.filter((h) => h === '二维码') || []).length === 2, 'qrHeads=' + L3.heads.filter((h) => h === '二维码').length)

  const png3 = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./shot-range-print-paged.png', import.meta.url), Buffer.from(png3.result.data, 'base64'))
  console.log('[written] shot-range-print-paged.png')

  if (s.logs.length) console.log('页面错误日志:', s.logs.slice(0, 5))
  console.log('RESULT:', fail === 0 ? 'PASS' : 'FAIL', `(pass=${pass}, fail=${fail})`)
  process.exitCode = fail === 0 ? 0 : 1
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
