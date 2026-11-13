// round-05.mjs — 验收第 5 轮:清单 4 复核(连续两次干净 reload 后测量,排除偶发)+ 暖态翻页/筛选耗时拆分
// 只读:仅查询/翻页/筛选,不点任何写操作
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

// ── 页面内仪表(每轮 reload 后重装) ──
async function installInstrument() {
  await page.evaluate(() => {
    window.__S = { reqs: [], lt: [], M: null }
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
    window.__mkM = (label, expectReq) => {
      const sig = window.__rowSig()
      window.__S.M = { label, t0: performance.now(), baselineRows: sig.rows, baselineFirst: sig.first, expectReq: expectReq || '/px/workOrderList', done: false, timedOut: false, stable: 0, rows: sig.rows, first: sig.first }
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
        M.done = true
        M.settleElapsed = Math.round(now - M.t0)
        M.finalRows = sig.rows
        M.finalFirst = sig.first
      } else if (now - M.t0 > 90000) {
        M.done = true; M.timedOut = true; M.settleElapsed = Math.round(now - M.t0); M.finalRows = sig.rows; M.finalFirst = sig.first
      }
    }, 100)
  })
}

async function readM() {
  return page.evaluate(() => {
    const S = window.__S
    const M = S.M
    if (!M) return null
    const t0 = M.t0
    const reqs = S.reqs.filter((r) => r.start >= t0 - 5).map((r) => ({ url: r.url, startRel: Math.round(r.start - t0), endRel: r.end != null ? Math.round(r.end - t0) : null, dur: r.dur, status: r.status }))
    const lt = S.lt.filter((x) => x.end > t0 - 100).map((x) => ({ startRel: x.start - Math.round(t0), endRel: x.end - Math.round(t0), dur: x.dur }))
    const q = document.querySelector('.wol-query')
    const pag = document.querySelector('.wol-pager .el-pagination')
    return {
      label: M.label, done: M.done, timedOut: M.timedOut, settleElapsed: M.settleElapsed, finalRows: M.finalRows, finalFirst: M.finalFirst,
      reqs, longTasks: lt, lastLongEndRel: lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0,
      countText: (document.querySelector('.wol-count') || {}).innerText,
      pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
      inputs: q ? [...q.querySelectorAll('.el-range-input')].map((i) => i.value) : null,
      ths: document.querySelectorAll('.wol-table .el-table__header th').length,
    }
  })
}

async function pollDone(timeoutMs = 90000) {
  const dl = Date.now() + timeoutMs
  let m = null
  while (Date.now() < dl) {
    await page.waitForTimeout(150)
    try { m = await page.evaluate(() => (window.__S && window.__S.M) ? { done: window.__S.M.done } : null) } catch (e) { continue }
    if (m && m.done) break
  }
  return m
}

async function fillWideAndQuery() {
  await page.click('.wol-query .drq-picker')
  await page.waitForTimeout(800)
  const startSel = '.wol-query .el-range-input >> nth=0'
  const endSel = '.wol-query .el-range-input >> nth=1'
  await page.fill(startSel, '')
  await page.fill(startSel, '2020-01-01')
  await page.fill(endSel, '')
  await page.fill(endSel, '2030-12-31')
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__mkM('big-range-query', '/px/workOrderList'))
  const t = Date.now()
  await page.press(endSel, 'Enter')
  await pollDone(90000)
  const wall = Date.now() - t
  const info = await readM()
  const res = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/api\/px\/(workOrderList|scheduleBoard\/dayPlan)/.test(e.name)).map((e) => ({ name: e.name.replace(location.origin, ''), start: Math.round(e.startTime), responseEnd: Math.round(e.responseEnd), duration: Math.round(e.duration), transferSize: e.transferSize })))
  return { wall, info, resources: res }
}

// ── 样本 1 ──
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await restoreWindow()
await installInstrument()
const s0 = await page.evaluate(() => ({ hash: location.hash, count: (document.querySelector('.wol-count') || {}).innerText, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length, inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value) }))
console.log('SAMPLE1 default: ' + JSON.stringify(s0))
const s1 = await fillWideAndQuery()
console.log('SAMPLE1 BIG QUERY: ' + JSON.stringify({ wall: s1.wall, settleElapsed: s1.info.settleElapsed, timedOut: s1.info.timedOut, finalRows: s1.info.finalRows, ths: s1.info.ths, countText: s1.info.countText, pager: s1.info.pager, lastLongEndRel: s1.info.lastLongEndRel, longTasks: s1.info.longTasks, reqs: s1.info.reqs, resources: s1.resources }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-sample1-big-query.png' })

// ── 暖态:翻到第 2 页(同一份 399 行数据,量渲染阻塞) ──
await page.evaluate(() => window.__mkM('page2-flip', '__never__'))
const tp = Date.now()
await page.click('.wol-pager .el-pager li >> nth=1')
await page.waitForTimeout(150)
await pollDone(60000)
const flip = await readM()
console.log('WARM PAGE2 FLIP: ' + JSON.stringify({ wall: Date.now() - tp, settleElapsed: flip.settleElapsed, finalRows: flip.finalRows, longTasks: flip.longTasks, lastLongEndRel: flip.lastLongEndRel }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-page2.png' })

// ── 暖态:状态筛选「未完工」→ 回第 1 页并渲染(清单 6 的动作之一) ──
const beforeFilter = await page.evaluate(() => ({ active: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, count: (document.querySelector('.wol-count') || {}).innerText }))
await page.evaluate(() => window.__mkM('filter-unfinished', '__never__'))
const tf = Date.now()
await page.click('.wol-line .el-radio-button >> nth=1')
await pollDone(60000)
const filt = await readM()
console.log('FILTER 未完工: ' + JSON.stringify({ beforeFilter, wall: Date.now() - tf, settleElapsed: filt.settleElapsed, finalRows: filt.finalRows, longTasks: filt.longTasks, pager: filt.pager, countText: filt.countText }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-filter-unfinished.png' })

// ── 样本 2(再次干净 reload,复核大范围查询;此轮顺带验证筛选回第1页/刷新) ──
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await restoreWindow()
await installInstrument()
const s2 = await fillWideAndQuery()
console.log('SAMPLE2 BIG QUERY: ' + JSON.stringify({ wall: s2.wall, settleElapsed: s2.info.settleElapsed, timedOut: s2.info.timedOut, finalRows: s2.info.finalRows, ths: s2.info.ths, countText: s2.info.countText, pager: s2.info.pager, lastLongEndRel: s2.info.lastLongEndRel, longTasks: s2.info.longTasks, reqs: s2.info.reqs, resources: s2.resources }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-sample2-big-query.png' })

// 清单 6:翻到第 2 页 → 点「刷新」→ 回第 1 页
if (s2.info.finalRows > 0) {
  await page.click('.wol-pager .el-pager li >> nth=1')
  await page.waitForTimeout(3500)
  const onPage2 = await page.evaluate(() => ({ active: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length }))
  await page.evaluate(() => window.__mkM('refresh-after-page2', '__never__'))
  await page.click('text="刷新"') // 按钮条里的「刷新」= onQuery:按当前条件重查并回第 1 页
  await pollDone(60000)
  const afterRefresh = await readM()
  console.log('REFRESH FROM PAGE2: ' + JSON.stringify({ onPage2, afterRefresh: { pager: afterRefresh.pager, rows: afterRefresh.finalRows, settleElapsed: afterRefresh.settleElapsed } }, null, 2))
}
console.log('DONE round-05')
