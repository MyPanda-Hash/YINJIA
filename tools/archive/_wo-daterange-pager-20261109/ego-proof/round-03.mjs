// round-03.mjs — 验收第 3 轮(核心):清单 4 大日期范围防卡实测
// 口径:整页重新加载(回到默认 15 天窗口)→ 把日期范围拉到 2020-01-01~2030-12-31 → 触发查询 →
//      量「从触发到页面重新可交互」耗时 + 表格实际渲染行/列 + 期间最长长任务。
// 只读:仅查询,不点任何写操作
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const URL = 'http://localhost:5173/#/prod/plan/workOrderList'

const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed spaceId=' + task.spaceId + ' page=' + page.label)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(600)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

const state = () => page.evaluate(() => {
  const table = document.querySelector('.wol-table')
  const rows = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  const pag = document.querySelector('.wol-pager .el-pagination')
  const wol = document.querySelector('.wol-page')
  const ss = wol && wol.__vueParentComponent && wol.__vueParentComponent.setupState
  return {
    rows: rows.length,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    countText: (document.querySelector('.wol-count') || {}).innerText,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value),
    firstRow: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
    lastRow: rows.length ? (rows[rows.length - 1].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
    setup: ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || [])), pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length } : null,
    errs: window.__errs || null,
    warns: window.__warns ? window.__warns.length : null,
  }
})

// ── 整页重新加载 ⇒ 默认 15 天窗口 ──
await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()

// ── 页面内控制台钩子(清单 7 用;记录本轮交互期间 console.error / window.error / unhandledrejection) ──
await page.evaluate(() => {
  window.__errs = []
  window.__warns = []
  const oe = console.error.bind(console)
  console.error = (...a) => { window.__errs.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 400)); return oe(...a) }
  const ow = console.warn.bind(console)
  console.warn = (...a) => { window.__warns.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 200)); return ow(...a) }
  window.addEventListener('error', (e) => window.__errs.push('window.error: ' + (e.message || '')))
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('unhandledrejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 300)))
})

const before = await state()
console.log('DEFAULT (after reload): ' + JSON.stringify(before))

// ── 填日期(先填好,再单独看输入动作是否已触发查询) ──
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(900)
const startSel = '.wol-query .el-range-input >> nth=0'
const endSel = '.wol-query .el-range-input >> nth=1'
await page.fill(startSel, '')
await page.fill(startSel, '2020-01-01')
await page.fill(endSel, '')
await page.fill(endSel, '2030-12-31')
await page.waitForTimeout(600)
const afterFillBeforeEnter = await state()
console.log('AFTER FILL (before Enter): ' + JSON.stringify({ rows: afterFillBeforeEnter.rows, countText: afterFillBeforeEnter.countText, inputs: afterFillBeforeEnter.inputs, setup: afterFillBeforeEnter.setup }))

// ── 安装页面内测量:长任务 + loading 出现/消失 + 行数稳定 + 无长任务 450ms ──
await page.evaluate((initialRows) => {
  window.__lt = []
  window.__M = { t0: performance.now(), initialRows, done: false, sawLoading: false, rows: -1, finalRows: -1, elapsed: null, timedOut: false }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { window.__M.ltErr = String(e) }
  const t0 = window.__M.t0
  let lastRows = -1
  let stable = 0
  ;(function poll() {
    const table = document.querySelector('.wol-table')
    const rows = table ? table.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1
    const mask = table && table.querySelector('.el-loading-mask')
    const loading = !!(mask && getComputedStyle(mask).display !== 'none')
    if (loading) window.__M.sawLoading = true
    window.__M.rows = rows
    if (rows === lastRows) stable += 1; else { stable = 0; lastRows = rows }
    const now = performance.now()
    const recentLong = window.__lt.some((x) => x.start > now - 450)
    const changed = window.__M.sawLoading || rows !== initialRows
    const settled = changed && (window.__M.sawLoading ? (!loading && stable >= 5 && !recentLong) : (stable >= 8 && !recentLong && rows > 0))
    if (settled) { window.__M.done = true; window.__M.finalRows = rows; window.__M.elapsed = Math.round(now - t0); return }
    if (now - t0 > 60000) { window.__M.done = true; window.__M.timedOut = true; window.__M.finalRows = rows; window.__M.elapsed = Math.round(now - t0); return }
    setTimeout(poll, 80)
  })()
}, afterFillBeforeEnter.rows)

// ── 触发:回车(若输入已触发过查询,这里仍会再走一次 onQuery,等价用户「改日期→查询」) ──
const triggerAt = Date.now()
await page.press(endSel, 'Enter')
console.log('trigger: Enter pressed at ' + triggerAt)

// Node 侧轮询测量结果(每 200ms 读一次;若主线程卡住,evaluate 会等,不会误判)
let m = null
const nodeDeadline = Date.now() + 90000
while (Date.now() < nodeDeadline) {
  await page.waitForTimeout(200)
  try {
    m = await page.evaluate(() => window.__M || null)
  } catch (e) { console.log('poll evaluate err: ' + e.message); continue }
  if (m && m.done) break
}
const wallMs = Date.now() - triggerAt
const lt = await page.evaluate(() => window.__lt || [])
console.log('MEASUREMENT: ' + JSON.stringify({
  wallMsFromEnter: wallMs,
  inPageElapsedMs: m ? m.elapsed : null,
  timedOut: m ? m.timedOut : null,
  sawLoading: m ? m.sawLoading : null,
  finalRows: m ? m.finalRows : null,
  longTasks: lt.length,
  longTaskMaxMs: lt.reduce((a, b) => Math.max(a, b.dur), 0),
  longTaskTotalMs: lt.reduce((a, b) => a + b.dur, 0),
  longTaskTop: [...lt].sort((a, b) => b.dur - a.dur).slice(0, 6),
}, null, 2))

const afterBig = await state()
console.log('AFTER BIG QUERY: ' + JSON.stringify(afterBig, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-big-range-after.png' })
console.log('screenshot -> ' + OUT + '/round-03-big-range-after.png')

// ── 二次测量(同一区间再点「查找」= 纯查询+渲染路径,不含填日期开销) ──
await page.evaluate((initialRows) => {
  window.__lt2 = []
  window.__M2 = { t0: performance.now(), initialRows, done: false, sawLoading: false, rows: -1, finalRows: -1, elapsed: null, timedOut: false }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt2.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { window.__M2.ltErr = String(e) }
  const t0 = window.__M2.t0
  let lastRows = -1
  let stable = 0
  ;(function poll() {
    const table = document.querySelector('.wol-table')
    const rows = table ? table.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1
    const mask = table && table.querySelector('.el-loading-mask')
    const loading = !!(mask && getComputedStyle(mask).display !== 'none')
    if (loading) window.__M2.sawLoading = true
    window.__M2.rows = rows
    if (rows === lastRows) stable += 1; else { stable = 0; lastRows = rows }
    const now = performance.now()
    const recentLong = window.__lt2.some((x) => x.start > now - 450)
    const changed = window.__M2.sawLoading || window.__M2.sawLoading
    const settled = (window.__M2.sawLoading || stable >= 3) && !loading && stable >= 5 && !recentLong
    if (settled) { window.__M2.done = true; window.__M2.finalRows = rows; window.__M2.elapsed = Math.round(now - t0); return }
    if (now - t0 > 60000) { window.__M2.done = true; window.__M2.timedOut = true; window.__M2.elapsed = Math.round(now - t0); return }
    setTimeout(poll, 80)
  })()
}, afterBig.rows)

const t2 = Date.now()
await page.click('.wol-query .el-button')
console.log('trigger2: 查找 clicked at ' + t2)
let m2 = null
const d2 = Date.now() + 90000
while (Date.now() < d2) {
  await page.waitForTimeout(200)
  try { m2 = await page.evaluate(() => window.__M2 || null) } catch (e) { console.log('poll2 evaluate err: ' + e.message); continue }
  if (m2 && m2.done) break
}
const wall2 = Date.now() - t2
const lt2 = await page.evaluate(() => window.__lt2 || [])
const afterRe = await state()
console.log('SECOND MEASUREMENT (查找 re-query): ' + JSON.stringify({
  wallMsFromClick: wall2,
  inPageElapsedMs: m2 ? m2.elapsed : null,
  timedOut: m2 ? m2.timedOut : null,
  sawLoading: m2 ? m2.sawLoading : null,
  finalRowsAfter: afterRe.rows,
  ths: afterRe.ths,
  longTasks: lt2.length,
  longTaskMaxMs: lt2.reduce((a, b) => Math.max(a, b.dur), 0),
  longTaskTop: [...lt2].sort((a, b) => b.dur - a.dur).slice(0, 6),
}, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-big-range-requery.png' })
console.log('screenshot -> ' + OUT + '/round-03-big-range-requery.png')
console.log('CONSOLE: ' + JSON.stringify({ errs: afterRe.errs, warnCount: afterRe.warns }))
console.log('DONE round-03')
