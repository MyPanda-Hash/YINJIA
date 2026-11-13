// round-10.mjs — 补充对照测量:同一会话内 页大小 100 vs 50 的大范围查询/重查耗时(供 Lead 判断修法)
// 只读:查询/改页大小/翻页,不点任何写操作
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const URL = 'http://localhost:5173/#/prod/plan/workOrderList'

const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed page=' + page.label)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(6000)
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)
await restoreWindow()
console.log('fresh: ' + JSON.stringify(await page.evaluate(() => ({ count: (document.querySelector('.wol-count') || {}).innerText, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length, inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value) }))))

// 仪表(通用 settle:请求已发出且完成 + 行数稳定 6 次 + 近 500ms 无长任务)
await page.evaluate(() => {
  window.__S = { reqs: [], lt: [], M: null }
  const X = window.XMLHttpRequest
  const open = X.prototype.open
  const send = X.prototype.send
  X.prototype.open = function (m, u, ...rest) { this.__url = u; return open.call(this, m, u, ...rest) }
  X.prototype.send = function (body) {
    const rec = { url: String(this.__url || ''), start: performance.now(), end: null, dur: null }
    window.__S.reqs.push(rec)
    this.addEventListener('loadend', () => { rec.end = performance.now(); rec.dur = Math.round(rec.end - rec.start) })
    return send.call(this, body)
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__S.lt.push({ start: Math.round(e.startTime), end: Math.round(e.startTime + e.duration), dur: Math.round(e.duration) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { window.__S.ltErr = String(e) }
  window.__trs = () => [...document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr')]
  window.__rowSig = () => { const t = window.__trs(); return { rows: t.length, first: t[0] ? (t[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : '' } }
  window.__mkM = (label, mode) => { const s = window.__rowSig(); window.__S.M = { label, mode: mode || 'req', t0: performance.now(), sawReq: false, done: false, stable: 0, rows: s.rows, first: s.first, bRows: s.rows, bFirst: s.first } }
  setInterval(() => {
    const M = window.__S.M
    if (!M || M.done) return
    const s = window.__rowSig()
    if (s.rows === M.rows && s.first === M.first) M.stable += 1; else { M.stable = 0; M.rows = s.rows; M.first = s.first }
    const now = performance.now()
    if (window.__S.reqs.some((r) => r.start >= M.t0 - 5)) M.sawReq = true
    const pending = window.__S.reqs.some((r) => r.start >= M.t0 - 5 && r.end == null)
    const recentLong = window.__S.lt.some((x) => x.end > now - 500)
    const changed = s.rows !== M.bRows || s.first !== M.bFirst
    const gate = M.mode === 'change' ? (changed && !recentLong) : (M.sawReq && !pending && !recentLong)
    if (gate && M.stable >= 6) {
      M.done = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows
    } else if (now - M.t0 > 90000) {
      M.done = true; M.timedOut = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows
    }
  }, 100)
})

async function readM() {
  return page.evaluate(() => {
    const S = window.__S, M = S.M, t = M.t0
    const lt = S.lt.filter((x) => x.end > t - 100).map((x) => ({ startRel: x.start - Math.round(t), endRel: x.end - Math.round(t), dur: x.dur }))
    const pageEl = document.querySelector('.wol-page')
    const ss = pageEl && pageEl.__vueParentComponent.setupState
    const pag = document.querySelector('.wol-pager .el-pagination')
    return {
      label: M.label, settleElapsed: M.settleElapsed, timedOut: M.timedOut, finalRows: M.finalRows,
      longTasks: lt, lastLongEndRel: lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0,
      longTaskSum: lt.reduce((a, b) => a + b.dur, 0),
      ths: document.querySelectorAll('.wol-table .el-table__header th').length,
      countText: (document.querySelector('.wol-count') || {}).innerText,
      pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
      activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
      setup: ss ? { pageSize: ss.pageSize, pageNo: ss.pageNo, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length } : null,
    }
  })
}
async function pollDone(timeout = 90000) {
  const dl = Date.now() + timeout
  while (Date.now() < dl) {
    await page.waitForTimeout(150)
    let d = false
    try { d = await page.evaluate(() => !!(window.__S.M && window.__S.M.done)) } catch (e) { continue }
    if (d) return true
  }
  return false
}
async function measure(label, fn, mode = 'req', timeout = 90000) {
  await page.evaluate(([l, m]) => window.__mkM(l, m), [label, mode])
  const t = Date.now()
  await fn()
  await pollDone(timeout)
  const info = await readM()
  info.wall = Date.now() - t
  console.log(label + ': ' + JSON.stringify({ wall: info.wall, settleElapsed: info.settleElapsed, finalRows: info.finalRows, longTaskSum: info.longTaskSum, lastLongEndRel: info.lastLongEndRel, longTasks: info.longTasks, setup: info.setup, pager: info.pager, activePage: info.activePage }, null, 2))
  return info
}

// 1) 冷启动:把日期拉到 2020-01-01~2030-12-31(默认 pageSize=100)
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(800)
const startSel = '.wol-query .el-range-input >> nth=0'
const endSel = '.wol-query .el-range-input >> nth=1'
await page.fill(startSel, '')
await page.fill(startSel, '2020-01-01')
await page.fill(endSel, '')
await page.fill(endSel, '2030-12-31')
await page.waitForTimeout(400)
await page.evaluate(() => window.__mkM('cold-wide-@100'))
const t = Date.now()
await page.press(endSel, 'Enter')
await pollDone(90000)
const cold = await readM()
cold.wall = Date.now() - t
console.log('COLD WIDE @100: ' + JSON.stringify({ wall: cold.wall, settleElapsed: cold.settleElapsed, finalRows: cold.finalRows, longTaskSum: cold.longTaskSum, lastLongEndRel: cold.lastLongEndRel, longTasks: cold.longTasks }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-10-cold-wide-100.png' })

// 2) 暖态重查 @100
await measure('requery-@100', async () => { await page.click('text="查找"') })

// 3) 页大小 → 50(暖态),再重查 @50
await measure('pagesize-50-set', async () => {
  await page.click('.wol-pager .el-select__wrapper')
  await page.waitForTimeout(600)
  await page.click('text=50条/页')
}, 'change')
await measure('requery-@50', async () => { await page.click('text="查找"') })
await restoreWindow()
await page.screenshot({ path: OUT + '/round-10-requery-50.png' })

// 4) 页大小 → 100,再重查 @100(同一会话对照)
await measure('pagesize-100-set', async () => {
  await page.click('.wol-pager .el-select__wrapper')
  await page.waitForTimeout(600)
  await page.click('text=100条/页')
}, 'change')
await measure('requery-@100-again', async () => { await page.click('text="查找"') })
await restoreWindow()
await page.screenshot({ path: OUT + '/round-10-requery-100.png' })

console.log('DONE round-10')
