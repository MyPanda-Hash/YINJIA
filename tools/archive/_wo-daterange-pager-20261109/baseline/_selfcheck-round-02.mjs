// round-02.mjs — T4 修后自测(Lead):分页默认 50 + 大范围查询耗时 + 控件宽度
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-perf-20261109'
await fs.mkdir(OUT, { recursive: true })
const URL = 'http://localhost:5173/#/prod/plan/workOrderList?perf=' + Date.now()
const task = await taskSpace('wo-daterange-perf-20261109')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(5000)

if (await page.evaluate(() => location.hash === '#/login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto(URL, { timeout: 40000 })
  await page.waitForTimeout(5000)
}

await restoreWindow()
const state = await page.evaluate(() => {
  const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
  const pager = document.querySelector('.wol-pager .el-pagination')
  const widths = [...document.querySelectorAll('.wol-query .el-date-editor')].map((el) => Math.round(el.getBoundingClientRect().width))
  const pageSizeText = [...document.querySelectorAll('.wol-pager .el-pagination__sizes .el-select__placeholder, .wol-pager .el-select__placeholder')].map((e) => e.textContent).slice(0, 2)
  return {
    hash: location.hash, rows, ths: ths.length,
    dateThs: ths.filter((t) => /dp-col-/.test(t.className)).length,
    hasPager: !!pager, totalText: (document.querySelector('.wol-pager .el-pagination__total') || {}).textContent,
    pageCount: document.querySelectorAll('.wol-pager .el-pager li').length,
    activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).textContent,
    datePickerWidths: widths, datePlaceholders: [...document.querySelectorAll('.wol-query .el-date-editor input')].map((i) => i.placeholder), pageSizeText,
    countText: (document.querySelector('.wol-count') || {}).innerText,
  }
})
console.log('SMOKE state: ' + JSON.stringify(state, null, 2))
await page.screenshot({ path: OUT + '/round-02-smoke-default.png' })

// 冷查询:从默认 15 天(12 行)状态,用组件内部把区间拉到 2020~2030 并触发 onQuery(真实 UI 输入由独立验收脚本覆盖)
const metrics = await page.evaluate(async () => {
  const later = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__lt = []
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }) }).observe({ entryTypes: ['longtask'] }) } catch { /* ignore */ }
  const inst = document.querySelector('.wol-page').__vueParentComponent
  inst.setupState.datePick = ['2020-01-01', '2030-12-31']
  const t0 = performance.now()
  inst.setupState.onQuery()
  let sawLoading = false, lastRows = -1, stable = 0
  const deadline = Date.now() + 12000
  let finalRows = 0
  while (Date.now() < deadline) {
    await later(100)
    const mask = document.querySelector('.wol-table .el-loading-mask')
    if (mask && getComputedStyle(mask).display !== 'none') sawLoading = true
    const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
    finalRows = rows
    if (rows === lastRows) stable += 1; else { stable = 0; lastRows = rows }
    const recentLong = window.__lt.some((x) => x.start > performance.now() - 500)
    const elapsedNow = performance.now() - t0
    if (stable >= 5 && rows > 0 && !recentLong && (sawLoading || elapsedNow > 3500)) break
  }
  const elapsed = Math.round(performance.now() - t0)
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
  const lt = window.__lt
  return {
    elapsed, sawLoading, rows: finalRows,
    ths: ths.length, dateThs: ths.filter((t) => /dp-col-/.test(t.className)).length,
    longTasks: lt.length, longTaskTotal: lt.reduce((a, b) => a + b.dur, 0), longTaskMax: lt.reduce((a, b) => Math.max(a, b.dur), 0),
    top: [...lt].sort((a, b) => b.dur - a.dur).slice(0, 6),
    totalText: (document.querySelector('.wol-pager .el-pagination__total') || {}).textContent,
    pageCount: document.querySelectorAll('.wol-pager .el-pager li').length,
    activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).textContent,
    countText: (document.querySelector('.wol-count') || {}).innerText,
  }
})
console.log('BIG-RANGE metrics: ' + JSON.stringify(metrics, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-smoke-big.png' })
console.log('done')
