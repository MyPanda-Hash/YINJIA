// round-09.mjs — 验收第 9 轮:清单 7(CDP 抓控制台:含页面加载期 + 交互期) + 补充测量(页大小 50 时大范围查询耗时,供 Lead 判断)
// 只读:查询/翻页/筛选/改页大小,不点任何写操作
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

// CDP 控制台:打开 ego 自动化隐藏之外的 Runtime 事件
try {
  await page.cdp('egoAutomated.disable')
  await page.cdp('Runtime.enable')
  await page.cdp('Log.enable')
  console.log('CDP console capture: enabled')
} catch (e) { console.log('CDP capture enable failed: ' + e.message) }

function summarizeEvents(events, tag) {
  const errs = []
  let warnN = 0
  let logN = 0
  for (const e of events) {
    if (!e || !e.method) continue
    if (e.method === 'Runtime.consoleAPICalled') {
      const t = e.params.type
      if (t === 'error') errs.push({ src: 'console.error', args: (e.params.args || []).map((a) => a.value !== undefined ? a.value : a.description || a.type).join(' ').slice(0, 300) })
      else if (t === 'warning') warnN += 1
      else logN += 1
    } else if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {}
      errs.push({ src: 'exception', text: (d.exception && (d.exception.description || d.exception.value)) || d.text || '' })
    } else if (e.method === 'Log.entryAdded') {
      const en = e.params.entry || {}
      if (en.level === 'error') errs.push({ src: 'log', text: (en.text || '').slice(0, 300) })
    }
  }
  return { tag, events: events.length, errorCount: errs.length, warnCount: warnN, logCount: logN, errors: errs.slice(0, 12) }
}

async function drain(tag) {
  const ev = await page.events()
  const s = summarizeEvents(ev, tag)
  console.log('CONSOLE[' + tag + ']: ' + JSON.stringify(s, null, 2))
  return s
}

// ── A. 整页加载期控制台 ──
await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(4000)
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)
const loadConsole = await drain('workOrderList-load')
await restoreWindow()

// ── B. 页大小改为 50 → 大范围查询测量(对比默认 100) ──
const before = await page.evaluate(() => ({ pageSize: document.querySelector('.wol-page').__vueParentComponent.setupState.pageSize, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length }))
await page.click('.wol-pager .el-select__wrapper')
await page.waitForTimeout(700)
await page.click('text=50条/页')
await page.waitForTimeout(1200)
const afterSize = await page.evaluate(() => ({ pageSize: document.querySelector('.wol-page').__vueParentComponent.setupState.pageSize, pager: (document.querySelector('.wol-pager .el-pagination') || {}).innerText }))
console.log('PAGE SIZE 50 set: ' + JSON.stringify({ before, afterSize }))

// 仪表
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
  window.__mkM = (label) => { const s = window.__rowSig(); window.__S.M = { label, t0: performance.now(), bR: s.rows, bF: s.first, done: false, stable: 0, rows: s.rows, first: s.first } }
  setInterval(() => {
    const M = window.__S.M
    if (!M || M.done) return
    const s = window.__rowSig()
    if (s.rows === M.rows && s.first === M.first) M.stable += 1; else { M.stable = 0; M.rows = s.rows; M.first = s.first }
    const now = performance.now()
    const pending = window.__S.reqs.some((r) => r.start >= M.t0 - 5 && r.end == null)
    const recentLong = window.__S.lt.some((x) => x.end > now - 500)
    const changing = s.rows !== M.bR || s.first !== M.bF
    if (changing && !pending && M.stable >= 6 && !recentLong) { M.done = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows }
    else if (now - M.t0 > 90000) { M.done = true; M.timedOut = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = s.rows }
  }, 100)
})

await page.click('.wol-query .drq-picker')
await page.waitForTimeout(800)
const startSel = '.wol-query .el-range-input >> nth=0'
const endSel = '.wol-query .el-range-input >> nth=1'
await page.fill(startSel, '')
await page.fill(startSel, '2020-01-01')
await page.fill(endSel, '')
await page.fill(endSel, '2030-12-31')
await page.waitForTimeout(400)
await page.evaluate(() => window.__mkM('big-range-page50'))
const t0 = Date.now()
await page.press(endSel, 'Enter')
let done = false
const dl = Date.now() + 90000
while (Date.now() < dl) {
  await page.waitForTimeout(150)
  try { done = await page.evaluate(() => !!(window.__S.M && window.__S.M.done)) } catch (e) { continue }
  if (done) break
}
const wall = Date.now() - t0
const info = await page.evaluate(() => {
  const M = window.__S.M; const t = M.t0
  const lt = window.__S.lt.filter((x) => x.end > t - 100).map((x) => ({ startRel: x.start - Math.round(t), endRel: x.end - Math.round(t), dur: x.dur }))
  const trs = window.__trs()
  return { settleElapsed: M.settleElapsed, timedOut: M.timedOut, finalRows: M.finalRows, ths: document.querySelectorAll('.wol-table .el-table__header th').length, longTasks: lt, lastLongEndRel: lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0, countText: (document.querySelector('.wol-count') || {}).innerText, pager: (document.querySelector('.wol-pager .el-pagination') || {}).innerText, pageSize: document.querySelector('.wol-page').__vueParentComponent.setupState.pageSize, actualRows: trs.length }
})
console.log('BIG QUERY @pageSize50: ' + JSON.stringify({ wall, ...info }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-09-bigrange-page50.png' })
const interactionConsole = await drain('bigrange-50pager')

// ── C. 再 reload,collected 加载期/交互期均无报错的最终结论 ──
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)
const reloadConsole = await drain('reload-final')
await page.evaluate(() => { const ss = document.querySelector('.wol-page').__vueParentComponent.setupState; window.__finalSetup = { pageSize: ss.pageSize, pageNo: ss.pageNo } })
const finalSetup = await page.evaluate(() => window.__finalSetup)
console.log('FINAL RELOAD STATE: ' + JSON.stringify(finalSetup))
await restoreWindow()

const allErrors = [...(loadConsole.errors || []), ...(interactionConsole.errors || []), ...(reloadConsole.errors || [])]
console.log('ITEM7 ALL CONSOLE ERRORS: ' + JSON.stringify({ count: allErrors.length, errors: allErrors.slice(0, 20), warns: (loadConsole.warnCount || 0) + (interactionConsole.warnCount || 0) + (reloadConsole.warnCount || 0) }, null, 2))
console.log('DONE round-09')
