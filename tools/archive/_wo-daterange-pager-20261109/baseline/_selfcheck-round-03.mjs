// round-03.mjs — T4 修后 Lead 自测:冷查询(整页刷新)+ 暖态重查 + 控件宽度
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-perf-20261109'
await fs.mkdir(OUT, { recursive: true })
const URL = 'http://localhost:5173/#/prod/plan/workOrderList'
const task = await taskSpace('wo-daterange-perf-20261109')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function runQuery(range, label) {
  return await page.evaluate(async ({ range, label }) => {
    const later = (ms) => new Promise((r) => setTimeout(r, ms))
    window.__lt = []
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ dur: Math.round(e.duration), at: Math.round(e.startTime) }) }).observe({ entryTypes: ['longtask'] }) } catch { /* ignore */ }
    const inst = document.querySelector('.wol-page').__vueParentComponent
    const beforeRows = inst.setupState.rows
    inst.setupState.datePick = range
    const t0 = performance.now()
    inst.setupState.onQuery()
    let lastRows = -1, stable = 0, finalRows = 0, changed = false
    const deadline = Date.now() + 12000
    while (Date.now() < deadline) {
      await later(80)
      const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
      finalRows = rows
      if (rows === lastRows) stable += 1; else { stable = 0; lastRows = rows }
      if (inst.setupState.rows !== beforeRows) changed = true
      const recentLong = window.__lt.some((x) => x.at > performance.now() - 600)
      if (changed && stable >= 4 && finalRows > 0 && !recentLong) break
    }
    const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
    const lt = window.__lt
    return {
      label,
      elapsed: Math.round(performance.now() - t0),
      rows: finalRows, ths: ths.length, dateThs: ths.filter((t) => /dp-col-/.test(t.className)).length,
      longTasks: lt.length, longTaskMax: lt.reduce((a, b) => Math.max(a, b.dur), 0),
      totalText: (document.querySelector('.wol-pager .el-pagination__total') || {}).textContent,
      pageCount: document.querySelectorAll('.wol-pager .el-pager li').length,
      pickerWidth: Math.round((document.querySelector('.wol-query .el-date-editor') || { getBoundingClientRect: () => ({ width: -1 }) }).getBoundingClientRect().width),
    }
  }, { range, label })
}

// ── 整页刷新(清掉 keep-alive 缓存状态)──
await page.goto(URL, { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6000)
await restoreWindow()
const cold0 = await page.evaluate(() => ({
  rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length,
  totalText: (document.querySelector('.wol-pager .el-pagination__total') || {}).textContent,
  pageSize: (document.querySelector('.wol-pager .el-select__placeholder') || {}).textContent,
  pickerWidth: Math.round((document.querySelector('.wol-query .el-date-editor') || { getBoundingClientRect: () => ({ width: -1 }) }).getBoundingClientRect().width),
}))
console.log('after reload(default window): ' + JSON.stringify(cold0))

const cold = await runQuery(['2020-01-01', '2030-12-31'], 'cold')
console.log('COLD: ' + JSON.stringify(cold))
const warm = await runQuery(['2019-01-01', '2030-12-31'], 'warm')
console.log('WARM: ' + JSON.stringify(warm))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-t4-big.png' })
console.log('done')
