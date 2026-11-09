// round-06.mjs — 验收第 6 轮:清单 6(筛选/刷新回第1页)+ 清单 8(跨页勾选)+ 清单 2 干净截图 + 大范围测量第 3 样本
// 只读:只查询/翻页/筛选/勾选(不触发任何写操作),勾选行后取消,不留状态
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
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function installInstrument() {
  await page.evaluate(() => {
    window.__S = { reqs: [], lt: [], M: null }
    window.__errs = []
    window.__warns = []
    const oe = console.error.bind(console)
    console.error = (...a) => { window.__errs.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 400)); return oe(...a) }
    const ow = console.warn.bind(console)
    console.warn = (...a) => { window.__warns.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 200)); return ow(...a) }
    window.addEventListener('error', (e) => window.__errs.push('window.error: ' + (e.message || '')))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('unhandledrejection: ' + String((e.reason && e.reason.message) || e.reason).slice(0, 300)))
    const X = window.XMLHttpRequest
    const open = X.prototype.open
    const send = X.prototype.send
    X.prototype.open = function (m, u, ...rest) { this.__url = u; return open.call(this, m, u, ...rest) }
    X.prototype.send = function (body) {
      const rec = { url: String(this.__url || ''), start: performance.now(), end: null, dur: null, status: null }
      window.__S.reqs.push(rec)
      this.addEventListener('loadend', () => { rec.end = performance.now(); rec.dur = Math.round(rec.end - rec.start); try { rec.status = this.status } catch (e) {} })
      return send.call(this, body)
    }
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__S.lt.push({ start: Math.round(e.startTime), end: Math.round(e.startTime + e.duration), dur: Math.round(e.duration) })
      }).observe({ entryTypes: ['longtask'] })
    } catch (e) { window.__S.ltErr = String(e) }
    window.__trs = () => [...document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr')]
    window.__rowSig = () => {
      const trs = window.__trs()
      return { rows: trs.length, first: trs[0] ? (trs[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : '' }
    }
    window.__mkM = (label) => {
      const sig = window.__rowSig()
      window.__S.M = { label, t0: performance.now(), baselineRows: sig.rows, baselineFirst: sig.first, done: false, timedOut: false, stable: 0, rows: sig.rows, first: sig.first }
    }
    setInterval(() => {
      const M = window.__S.M
      if (!M || M.done) return
      const sig = window.__rowSig()
      if (sig.rows === M.rows && sig.first === M.first) M.stable += 1
      else { M.stable = 0; M.rows = sig.rows; M.first = sig.first }
      const now = performance.now()
      const pending = window.__S.reqs.some((r) => r.start >= M.t0 - 5 && r.end == null)
      const recentLong = window.__S.lt.some((x) => x.end > now - 500)
      const changing = sig.rows !== M.baselineRows || sig.first !== M.baselineFirst
      if (changing && !pending && M.stable >= 6 && !recentLong) {
        M.done = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = sig.rows; M.finalFirst = sig.first
      } else if (now - M.t0 > 90000) {
        M.done = true; M.timedOut = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = sig.rows; M.finalFirst = sig.first
      }
    }, 100)
  })
}

const readM = () => page.evaluate(() => {
  const S = window.__S
  const M = S.M
  const t0 = M.t0
  const reqs = S.reqs.filter((r) => r.start >= t0 - 5).map((r) => ({ url: r.url, startRel: Math.round(r.start - t0), endRel: r.end != null ? Math.round(r.end - t0) : null, dur: r.dur }))
  const lt = S.lt.filter((x) => x.end > t0 - 100).map((x) => ({ startRel: x.start - Math.round(t0), endRel: x.end - Math.round(t0), dur: x.dur }))
  const pag = document.querySelector('.wol-pager .el-pagination')
  const wol = document.querySelector('.wol-page')
  const ss = wol && wol.__vueParentComponent && wol.__vueParentComponent.setupState
  const btn = (txt) => { const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === txt); return b ? { disabled: b.disabled, cls: b.className } : null }
  return {
    label: M.label, done: M.done, settleElapsed: M.settleElapsed, finalRows: M.finalRows, finalFirst: M.finalFirst,
    longTasks: lt, lastLongEndRel: lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0,
    activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    countText: (document.querySelector('.wol-count') || {}).innerText,
    inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value),
    ths: document.querySelectorAll('.wol-table .el-table__header th').length,
    setup: ss ? { stateFilter: ss.stateFilter, pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length, checkedLen: ss.checked ? ss.checked.length : null, datePick: JSON.parse(JSON.stringify(ss.datePick || [])) } : null,
    closeBtn: btn('结案'),
    checkedRows: ss && ss.checked ? ss.checked.map((r) => ({ 加工单号: r['加工单号'], 行号: r['行号'] })) : null,
    errs: window.__errs.slice(), errCount: window.__errs.length, warnCount: window.__warns.length,
  }
})

async function pollDone(timeoutMs = 90000) {
  const dl = Date.now() + timeoutMs
  while (Date.now() < dl) {
    await page.waitForTimeout(150)
    let done = false
    try { done = await page.evaluate(() => !!(window.__S && window.__S.M && window.__S.M.done)) } catch (e) { continue }
    if (done) return true
  }
  return false
}

async function actAndMeasure(label, fn, timeout = 90000) {
  await page.evaluate((l) => window.__mkM(l), label)
  const t = Date.now()
  await fn()
  await pollDone(timeout)
  const info = await readM()
  info.wall = Date.now() - t
  return info
}

// ── 干净 reload + 重装仪表 + 大范围查询(第 3 样本) ──
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await restoreWindow()
await installInstrument()
const fresh = await page.evaluate(() => ({
  count: (document.querySelector('.wol-count') || {}).innerText,
  rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length,
  inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value),
}))
console.log('FRESH: ' + JSON.stringify(fresh))

await page.click('.wol-query .drq-picker')
await page.waitForTimeout(800)
const startSel = '.wol-query .el-range-input >> nth=0'
const endSel = '.wol-query .el-range-input >> nth=1'
await page.fill(startSel, '')
await page.fill(startSel, '2020-01-01')
await page.fill(endSel, '')
await page.fill(endSel, '2030-12-31')
await page.waitForTimeout(400)
await page.evaluate(() => window.__mkM('big-range-sample3'))
const t3 = Date.now()
await page.press(endSel, 'Enter')
await pollDone(90000)
const big3 = await readM()
big3.wall = Date.now() - t3
console.log('SAMPLE3 BIG QUERY: ' + JSON.stringify({ wall: big3.wall, settleElapsed: big3.settleElapsed, finalRows: big3.finalRows, ths: big3.ths, countText: big3.countText, lastLongEndRel: big3.lastLongEndRel, longTasks: big3.longTasks }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-sample3-big-query.png' })

// ── 清单 6a:点「查找」= 查询 → 页码回第 1 页 ──
const s1 = await actAndMeasure('query-查找', async () => { await page.click('text="查找"') })
console.log('ITEM6 query(查找): ' + JSON.stringify({ wall: s1.wall, settleElapsed: s1.settleElapsed, activePage: s1.activePage, setup: s1.setup?.pageNo, filteredLen: s1.setup?.filteredLen, rows: s1.finalRows }))

// 翻到第 2 页
const s2 = await actAndMeasure('goto-page2', async () => { await page.click('.wol-pager .el-pager li >> nth=1') })
console.log('ITEM6 page2: ' + JSON.stringify({ wall: s2.wall, activePage: s2.activePage, setupPageNo: s2.setup?.pageNo, rows: s2.finalRows, firstRow: (s2.finalFirst || '').slice(0, 30) }))

// 状态筛选「未完工」→ 应回第 1 页
const s3 = await actAndMeasure('filter-unfinished', async () => { await page.click('.wol-line .el-radio-button >> nth=1') })
console.log('ITEM6 filter 未完工: ' + JSON.stringify({ wall: s3.wall, settleElapsed: s3.settleElapsed, activePage: s3.activePage, stateFilter: s3.setup?.stateFilter, pageNo: s3.setup?.pageNo, filteredLen: s3.setup?.filteredLen, rows: s3.finalRows, pager: s3.pager }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-filter-unfinished.png' })

// 状态筛选「已完工」→ 应回第 1 页
const s4 = await actAndMeasure('filter-finished', async () => { await page.click('.wol-line .el-radio-button >> nth=2') })
console.log('ITEM6 filter 已完工: ' + JSON.stringify({ wall: s4.wall, settleElapsed: s4.settleElapsed, activePage: s4.activePage, stateFilter: s4.setup?.stateFilter, pageNo: s4.setup?.pageNo, filteredLen: s4.setup?.filteredLen, rows: s4.finalRows, pager: s4.pager }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-filter-finished.png' })

// 回到「全部」
const s5 = await actAndMeasure('filter-all', async () => { await page.click('.wol-line .el-radio-button >> nth=0') })
console.log('ITEM6 filter 全部: ' + JSON.stringify({ wall: s5.wall, activePage: s5.activePage, stateFilter: s5.setup?.stateFilter, filteredLen: s5.setup?.filteredLen, rows: s5.finalRows }))

// 翻到第 2 页后点「刷新」→ 回第 1 页
const s6 = await actAndMeasure('goto-page2-again', async () => { await page.click('.wol-pager .el-pager li >> nth=1') })
console.log('ITEM6 page2 again: ' + JSON.stringify({ activePage: s6.activePage }))
const s7 = await actAndMeasure('refresh-from-page2', async () => { await page.click('text="刷新"') })
console.log('ITEM6 刷新(在第2页时点): ' + JSON.stringify({ wall: s7.wall, settleElapsed: s7.settleElapsed, activePage: s7.activePage, pageNo: s7.setup?.pageNo, rows: s7.finalRows, firstRow: (s7.finalFirst || '').slice(0, 30) }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-refresh-back-page1.png' })

// ── 清单 8:跨页勾选 ──
const beforeCheck = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, checkedLen: ss.checked.length, closeDisabled: b ? b.disabled : null }
})
await page.click('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
await page.waitForTimeout(1200)
const checked1 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  const firstCb = document.querySelector('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
  return { checkedLen: ss.checked.length, checkedKeys: ss.checked.map((r) => r['加工单号'] + '#' + r['行号']), closeDisabled: b ? b.disabled : null, firstCheckboxCls: firstCb ? firstCb.className : null, activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText }
})
console.log('ITEM8 after check row1: ' + JSON.stringify({ beforeCheck, checked1 }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-selection-page1.png' })

// 翻到第 2 页
const s8 = await actAndMeasure('page2-with-selection', async () => { await page.click('.wol-pager .el-pager li >> nth=1') })
const onPage2 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, checkedLen: ss.checked.length, checkedKeys: ss.checked.map((r) => r['加工单号'] + '#' + r['行号']) }
})
console.log('ITEM8 on page2: ' + JSON.stringify({ wall: s8.wall, onPage2 }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-selection-page2.png' })

// 翻回第 1 页
const s9 = await actAndMeasure('back-page1-with-selection', async () => { await page.click('.wol-pager .el-pager li >> nth=0') })
const backPage1 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const rows = [...document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr')]
  const firstCb = rows[0] ? rows[0].querySelector('.el-checkbox') : null
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, rows: rows.length, checkedLen: ss.checked.length, checkedKeys: ss.checked.map((r) => r['加工单号'] + '#' + r['行号']), firstRowCheckboxCls: firstCb ? firstCb.className : null, closeDisabled: b ? b.disabled : null }
})
console.log('ITEM8 back to page1: ' + JSON.stringify({ wall: s9.wall, backPage1 }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-selection-back-page1.png' })

// 取消勾选,恢复干净状态(只取消选择,不是写操作)
await page.click('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
await page.waitForTimeout(600)
const cleared = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  return { checkedLen: ss.checked.length }
})
console.log('ITEM8 cleared: ' + JSON.stringify(cleared))

// ── 清单 2 干净截图:点快捷档「近 30 天」→ 日期/条数变化 ──
const beforeShortcut = await readM()
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(900)
const shortcuts = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel__shortcut')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
await page.evaluate(() => window.__mkM('shortcut-30d'))
const tsc = Date.now()
await page.click('text=近 30 天')
await pollDone(40000)
const sc = await readM()
sc.wall = Date.now() - tsc
console.log('ITEM2 shortcut 近30天: ' + JSON.stringify({ before: { count: beforeShortcut.countText, inputs: beforeShortcut.inputs, rows: beforeShortcut.finalRows }, shortcuts, after: { count: sc.countText, inputs: sc.inputs, rows: sc.finalRows, datePick: sc.setup?.datePick, wall: sc.wall } }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-06-shortcut-30d-clean.png' })

// ── 清单 7 汇总:控制台报错 ──
const consoleInfo = await page.evaluate(() => ({ errs: window.__errs.slice(), warnCount: window.__warns.length, warnSample: window.__warns.slice(0, 6) }))
console.log('ITEM7 CONSOLE: ' + JSON.stringify(consoleInfo, null, 2))
console.log('DONE round-06')
