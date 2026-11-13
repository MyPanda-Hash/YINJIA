// round-11.mjs — T5 复测(核心):3 个样本「整页 reload → 默认 12 行 → 大范围 2020-01-01~2030-12-31 冷查询」耗时
// 口径与 T3 round-04/05/09 相同:PerformanceObserver longtask + XHR 时间线 + 行数稳定 6 次(600ms)+ 近 500ms 无长任务
// 只读:只查询/开关日期面板,不点任何写操作
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
    window.__rowSig = () => { const t = window.__trs(); return { rows: t.length, first: t[0] ? (t[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : '' } }
    window.__mkM = (label) => { const s = window.__rowSig(); window.__S.M = { label, t0: performance.now(), sawReq: false, done: false, stable: 0, rows: s.rows, first: s.first } }
    setInterval(() => {
      const M = window.__S.M
      if (!M || M.done) return
      const s = window.__rowSig()
      if (s.rows === M.rows && s.first === M.first) M.stable += 1; else { M.stable = 0; M.rows = s.rows; M.first = s.first }
      const now = performance.now()
      if (window.__S.reqs.some((r) => r.start >= M.t0 - 5)) M.sawReq = true
      const pending = window.__S.reqs.some((r) => r.start >= M.t0 - 5 && r.end == null)
      const recentLong = window.__S.lt.some((x) => x.end > now - 500)
      if (M.sawReq && !pending && M.stable >= 6 && !recentLong) {
        M.done = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows
      } else if (now - M.t0 > 90000) {
        M.done = true; M.timedOut = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows
      }
    }, 100)
  })
}

const readM = () => page.evaluate(() => {
  const S = window.__S, M = S.M, t = M.t0
  const lt = S.lt.filter((x) => x.end > t - 100).map((x) => ({ startRel: x.start - Math.round(t), endRel: x.end - Math.round(t), dur: x.dur }))
  const reqs = S.reqs.filter((r) => r.start >= t - 5).map((r) => ({ url: r.url, startRel: Math.round(r.start - t), endRel: r.end != null ? Math.round(r.end - t) : null, dur: r.dur, status: r.status }))
  const pageEl = document.querySelector('.wol-page')
  const ss = pageEl && pageEl.__vueParentComponent.setupState
  const pag = document.querySelector('.wol-pager .el-pagination')
  const table = document.querySelector('.wol-table')
  const drq = document.querySelector('.wol-query .el-date-editor')
  return {
    label: M.label, settleElapsed: M.settleElapsed, timedOut: M.timedOut, finalRows: M.finalRows,
    longTasks: lt, longTaskSum: lt.reduce((a, b) => a + b.dur, 0), lastLongEndRel: lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0,
    reqs,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    cells: (table ? table.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0) * (table ? table.querySelectorAll('.el-table__header th').length : 0),
    countText: (document.querySelector('.wol-count') || {}).innerText,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
    setup: ss ? { pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length, datePick: JSON.parse(JSON.stringify(ss.datePick || [])) } : null,
    drqWidth: drq ? Math.round(drq.getBoundingClientRect().width) : null,
    inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value),
    errs: window.__errs.slice(), warnCount: window.__warns.length,
  }
})

async function pollDone(timeout = 60000) {
  const dl = Date.now() + timeout
  while (Date.now() < dl) {
    await page.waitForTimeout(120)
    let d = false
    try { d = await page.evaluate(() => !!(window.__S.M && window.__S.M.done)) } catch (e) { continue }
    if (d) return true
  }
  return false
}

const results = []
for (let i = 1; i <= 3; i++) {
  // 每次样本都整页刷新文档(goto + reload),确保是冷启动:keep-alive 不保留上次状态
  await page.goto(URL, { timeout: 40000 })
  await page.reload({ timeout: 60000 })
  await page.waitForTimeout(5000)
  await restoreWindow()
  await installInstrument()
  const def = await page.evaluate(() => {
    const pageEl = document.querySelector('.wol-page')
    const ss = pageEl && pageEl.__vueParentComponent.setupState
    const drq = document.querySelector('.wol-query .el-date-editor')
    const pag = document.querySelector('.wol-pager .el-pagination')
    return {
      hash: location.hash,
      rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length,
      countText: (document.querySelector('.wol-count') || {}).innerText,
      pageSize: ss ? ss.pageSize : null,
      pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
      inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((x) => ({ ph: x.placeholder, v: x.value })),
      drqExists: !!drq,
      drqWidth: drq ? Math.round(drq.getBoundingClientRect().width) : null,
      drqCls: drq ? String(drq.className) : null,
    }
  })
  console.log('SAMPLE' + i + ' DEFAULT(after reload): ' + JSON.stringify(def))

  if (i === 1) {
    // 顺带回归:控件形态 + 快捷档清单 + 宽度截图
    await page.click('.wol-query .el-date-editor')
    await page.waitForTimeout(1000)
    const panel = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('.el-picker-panel')].filter((p) => p.offsetParent !== null)
      const p = panels[panels.length - 1]
      return { visible: !!p, shortcuts: p ? [...p.querySelectorAll('.el-picker-panel__shortcut')].map((b) => (b.innerText || '').trim()) : [], headers: p ? [...p.querySelectorAll('.el-date-range-picker__header')].map((h) => (h.innerText || '').replace(/\s+/g, ' ').trim()) : [] }
    })
    console.log('SAMPLE1 PICKER PANEL: ' + JSON.stringify(panel))
    await restoreWindow()
    await page.screenshot({ path: OUT + '/round-11-sample1-picker-panel.png' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    await page.screenshot({ path: OUT + '/round-11-sample1-default.png' })
  }

  // 填大范围
  await page.click('.wol-query .el-date-editor')
  await page.waitForTimeout(900)
  const startSel = '.wol-query .el-range-input >> nth=0'
  const endSel = '.wol-query .el-range-input >> nth=1'
  await page.fill(startSel, '')
  await page.fill(startSel, '2020-01-01')
  await page.fill(endSel, '')
  await page.fill(endSel, '2030-12-31')
  await page.waitForTimeout(400)
  const preReq = await page.evaluate(() => window.__S.reqs.map((r) => r.url))
  console.log('SAMPLE' + i + ' reqs before Enter: ' + JSON.stringify(preReq))
  await page.evaluate(() => window.__mkM('cold-sample'))
  const t = Date.now()
  await page.press(endSel, 'Enter')
  await pollDone(60000)
  const m = await readM()
  m.wall = Date.now() - t
  // 资源计时(真实后端/网络耗时)
  m.resources = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/api\/px\/(workOrderList|scheduleBoard\/dayPlan)/.test(e.name)).map((e) => ({ name: e.name.replace(location.origin, ''), start: Math.round(e.startTime), responseEnd: Math.round(e.responseEnd), duration: Math.round(e.duration), transferSize: e.transferSize })))
  console.log('SAMPLE' + i + ' COLD RESULT: ' + JSON.stringify({ wall: m.wall, settleElapsed: m.settleElapsed, timedOut: m.timedOut, finalRows: m.finalRows, ths: m.ths, cells: m.cells, countText: m.countText, pager: m.pager, activePage: m.activePage, lastLongEndRel: m.lastLongEndRel, longTaskSum: m.longTaskSum, longTasks: m.longTasks, reqs: m.reqs, setup: m.setup, drqWidth: m.drqWidth, errs: m.errs, warnCount: m.warnCount }, null, 2))
  await restoreWindow()
  try { await page.mouse.move(760, 660) } catch (e) {}
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + '/round-11-sample' + i + '-cold.png' })
  results.push({ sample: i, def, picker: null, m })
}
await fs.writeFile(OUT + '/round-11-results.json', JSON.stringify(results.map((r) => ({ sample: r.sample, def: { rows: r.def.rows, countText: r.def.countText, pageSize: r.def.pageSize, pager: r.def.pager, inputs: r.def.inputs, drqWidth: r.def.drqWidth }, wall: r.m.wall, settleElapsed: r.m.settleElapsed, timedOut: r.m.timedOut, finalRows: r.m.finalRows, ths: r.m.ths, cells: r.m.cells, countText: r.m.countText, pager: r.m.pager, activePage: r.m.activePage, lastLongEndRel: r.m.lastLongEndRel, longTaskSum: r.m.longTaskSum, longTaskMax: Math.max(0, ...(r.m.longTasks || []).map((x) => x.dur)), longTasks: r.m.longTasks, resources: r.m.resources })), null, 2))
console.log('SUMMARY: ' + JSON.stringify(results.map((r) => ({ sample: r.sample, settleElapsed: r.m.settleElapsed, lastLongEndRel: r.m.lastLongEndRel, longTaskSum: r.m.longTaskSum, finalRows: r.m.finalRows, ths: r.m.ths, cells: r.m.cells, countText: r.m.countText, pager: r.m.pager })), null, 2))
console.log('DONE round-11')
