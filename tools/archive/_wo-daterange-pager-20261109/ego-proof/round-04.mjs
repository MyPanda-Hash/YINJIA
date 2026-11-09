// round-04.mjs — 验收第 4 轮:清单 4 重做(干净 reload 后真实「改大范围→查询」测量,XHR/长任务全时间线)
//                            + 清单 3 分页(399 行 4 页、翻页行数/首行、页大小档位)
// 只读:只做查询/翻页,不点任何写操作
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
  const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  const pag = document.querySelector('.wol-pager .el-pagination')
  const wol = document.querySelector('.wol-page')
  const ss = wol && wol.__vueParentComponent && wol.__vueParentComponent.setupState
  const rowKeys = trs.map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40))
  return {
    rows: trs.length,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    countText: (document.querySelector('.wol-count') || {}).innerText,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
    inputs: [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value),
    firstRow: rowKeys[0] || null,
    lastRow: rowKeys[rowKeys.length - 1] || null,
    rowKeys,
    setup: ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || [])), pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length } : null,
  }
})

// ── 干净重载:回到默认 15 天窗口 ──
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await restoreWindow()
// 若被弹回登录页,自动登录
const hasLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (hasLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统')).click()
  })
  await page.waitForTimeout(5000)
  await page.goto(URL, { timeout: 40000 })
  await page.waitForTimeout(6000)
}
const fresh = await state()
console.log('FRESH (after reload): ' + JSON.stringify({ rows: fresh.rows, ths: fresh.ths, countText: fresh.countText, pager: fresh.pager, inputs: fresh.inputs, setup: fresh.setup }))

// ── 页面内测量仪表:patch XHR + 长任务 + 自走轮询 settle ──
await page.evaluate(() => {
  window.__I = { reqs: [], longTasks: [], t0: null, done: false, timeline: [] }
  const X = window.XMLHttpRequest
  const open = X.prototype.open
  const send = X.prototype.send
  X.prototype.open = function (m, u, ...rest) { this.__url = u; this.__method = m; return open.call(this, m, u, ...rest) }
  X.prototype.send = function (body) {
    const rec = { url: String(this.__url || ''), method: this.__method, start: performance.now(), end: null, dur: null, status: null, tRel: null }
    window.__I.reqs.push(rec)
    this.addEventListener('loadend', () => { rec.end = performance.now(); rec.dur = Math.round(rec.end - rec.start); try { rec.status = this.status } catch (e) {} })
    return send.call(this, body)
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__I.longTasks.push({ start: Math.round(e.startTime), end: Math.round(e.startTime + e.duration), dur: Math.round(e.duration) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { window.__I.ltErr = String(e) }
  // 自走 settle 监视器:t0 起,看到 /px/workOrderList 请求完成 + 行数稳定 8 次(每次 100ms)+ 近 600ms 无长任务 ⇒ done
  window.__I.monitor = () => {
    const t0 = performance.now()
    window.__I.t0 = t0
    let lastRows = -2
    let stable = 0
    const sample = () => {
      const trs = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
      if (trs === lastRows) stable += 1; else { stable = 0; lastRows = trs }
      if (window.__I.timeline.length < 400) window.__I.timeline.push({ t: Math.round(performance.now() - t0), rows: trs, stable })
    }
    const poll = () => {
      sample()
      const now = performance.now()
      const reqDone = window.__I.reqs.some((r) => r.url.includes('/px/workOrderList') && r.start >= t0 - 5 && r.end != null)
      const recentLong = window.__I.longTasks.some((x) => x.end > now - 600)
      if (reqDone && stable >= 8 && !recentLong) {
        requestAnimationFrame(() => {
          window.__I.settledAt = performance.now()
          window.__I.settleElapsed = Math.round(window.__I.settledAt - t0)
          window.__I.finalRows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
          window.__I.finalThs = document.querySelectorAll('.wol-table .el-table__header th').length
          window.__I.done = true
        })
        return
      }
      if (now - t0 > 60000) { window.__I.done = true; window.__I.timedOut = true; window.__I.settleElapsed = Math.round(now - t0); return }
      setTimeout(poll, 100)
    }
    poll()
  }
})

// ── 填日期(2020-01-01 ~ 2030-12-31) ──
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(900)
const startSel = '.wol-query .el-range-input >> nth=0'
const endSel = '.wol-query .el-range-input >> nth=1'
await page.fill(startSel, '')
await page.fill(startSel, '2020-01-01')
await page.fill(endSel, '')
await page.fill(endSel, '2030-12-31')
await page.waitForTimeout(500)
const preReq = await page.evaluate(() => window.__I.reqs.map((r) => ({ url: r.url, start: Math.round(r.start), end: r.end != null ? Math.round(r.end) : null })))
console.log('REQS BEFORE ENTER (filling may already trigger): ' + JSON.stringify(preReq))

// t0 = 回车前;monitor 先起,再触发
await page.evaluate(() => window.__I.monitor())
const tPress = Date.now()
await page.press(endSel, 'Enter')
console.log('Enter pressed (wall) ' + tPress)

let m = null
const deadline = Date.now() + 90000
while (Date.now() < deadline) {
  await page.waitForTimeout(150)
  try { m = await page.evaluate(() => window.__I.done ? window.__I : { done: false, reqs: window.__I.reqs.map((r) => ({ url: r.url, end: r.end != null })) }) } catch (e) { console.log('poll err: ' + e.message); continue }
  if (m.done) break
}
const wallFromEnter = Date.now() - tPress
const meas = await page.evaluate(() => {
  const I = window.__I
  const t0 = I.t0
  const reqs = I.reqs.filter((r) => r.start >= t0 - 5).map((r) => ({ url: r.url, startRel: Math.round(r.start - t0), endRel: r.end != null ? Math.round(r.end - t0) : null, dur: r.dur, status: r.status }))
  const lt = I.longTasks.filter((x) => x.end > t0 - 100).map((x) => ({ startRel: x.start - Math.round(t0), endRel: x.end - Math.round(t0), dur: x.dur }))
  const lastLongEnd = lt.length ? Math.max(...lt.map((x) => x.endRel)) : 0
  return { settleElapsed: I.settleElapsed, timedOut: I.timedOut, finalRows: I.finalRows, finalThs: I.finalThs, reqs, longTasks: lt, lastLongEndRel: lastLongEnd, timelineFirstChange: (I.timeline.find((s) => s.rows !== -2) || null) }
})
console.log('BIG-RANGE MEASUREMENT: ' + JSON.stringify({ ...meas, wallFromEnter }, null, 2))
const afterBig = await state()
console.log('AFTER BIG: ' + JSON.stringify({ rows: afterBig.rows, ths: afterBig.ths, countText: afterBig.countText, pager: afterBig.pager, activePage: afterBig.activePage, firstRow: afterBig.firstRow, lastRow: afterBig.lastRow, setup: afterBig.setup }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-bigrange-page1.png' })
console.log('screenshot -> ' + OUT + '/round-04-bigrange-page1.png')

// ── 清单 3:分页 ──
const page1Keys = afterBig.rowKeys.slice()
const pagerInfo = await page.evaluate(() => {
  const pag = document.querySelector('.wol-pager .el-pagination')
  const sizes = pag ? [...pag.querySelectorAll('.el-select__wrapper, .el-pagination__sizes')].length : 0
  return {
    pagerText: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    total: (pag && pag.querySelector('.el-pagination__total') || {}).innerText,
    pageBtns: pag ? [...pag.querySelectorAll('.el-pager li')].map((li) => ({ txt: (li.innerText || '').trim(), active: li.classList.contains('is-active') })) : [],
    sizeTxt: pag ? (pag.querySelector('.el-pagination__sizes .el-select__selected-item') || {}).innerText : null,
  }
})
console.log('PAGER INFO: ' + JSON.stringify(pagerInfo))

// 翻页辅助:点页码 → 等行数/首行变化稳定
async function gotoPage(n) {
  const tClick = Date.now()
  await page.evaluate((n) => window.__I.monitor(), n)
  // 找页码 li 文本 = n
  const liIdx = await page.evaluate((n) => {
    const lis = [...document.querySelectorAll('.wol-pager .el-pager li')]
    return lis.findIndex((li) => (li.innerText || '').trim() === String(n))
  }, n)
  if (liIdx < 0) return { error: 'page li not found', n }
  await page.click(`.wol-pager .el-pager li >> nth=${liIdx}`)
  let mm = null
  const dl = Date.now() + 30000
  while (Date.now() < dl) {
    await page.waitForTimeout(120)
    try { mm = await page.evaluate(() => ({ done: window.__I.done, settleElapsed: window.__I.settleElapsed, finalRows: window.__I.finalRows, timedOut: window.__I.timedOut })) } catch (e) { continue }
    if (mm.done) break
  }
  await page.waitForTimeout(300)
  const s = await state()
  return { wall: Date.now() - tClick, settle: mm, activePage: s.activePage, rows: s.rows, firstRow: s.firstRow, lastRow: s.lastRow, rowKeys: s.rowKeys }
}

const p2 = await gotoPage(2)
console.log('PAGE2: ' + JSON.stringify({ wall: p2.wall, settle: p2.settle, activePage: p2.activePage, rows: p2.rows, firstRow: p2.firstRow, lastRow: p2.lastRow, overlapWithP1: p2.rowKeys ? p2.rowKeys.filter((k) => page1Keys.includes(k)).length : null }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-pagination-page2.png' })
const p4 = await gotoPage(4)
console.log('PAGE4: ' + JSON.stringify({ wall: p4.wall, settle: p4.settle, activePage: p4.activePage, rows: p4.rows, firstRow: p4.firstRow, lastRow: p4.lastRow }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-pagination-page4.png' })
const pBack = await gotoPage(1)
console.log('PAGE1-BACK: ' + JSON.stringify({ wall: pBack.wall, settle: pBack.settle, activePage: pBack.activePage, rows: pBack.rows, firstRow: pBack.firstRow, sameFirstAsBefore: pBack.firstRow === afterBig.firstRow }))

// 页大小档位 [50,100,200] 下拉
await page.click('.wol-pager .el-select__wrapper')
await page.waitForTimeout(800)
const sizeOpts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
console.log('PAGE SIZE OPTIONS: ' + JSON.stringify(sizeOpts))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-page-sizes.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 选 50/页 → 应 50 行 8 页
await page.click('.wol-pager .el-select__wrapper')
await page.waitForTimeout(500)
await page.click('text=50条/页')
await page.waitForTimeout(2500)
const p50 = await state()
console.log('PAGE-SIZE 50: ' + JSON.stringify({ rows: p50.rows, pager: p50.pager, activePage: p50.activePage, setup: p50.setup }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-pagesize-50.png' })
// 回到 100/页
await page.click('.wol-pager .el-select__wrapper')
await page.waitForTimeout(500)
await page.click('text=100条/页')
await page.waitForTimeout(2500)
const p100 = await state()
console.log('PAGE-SIZE BACK 100: ' + JSON.stringify({ rows: p100.rows, pager: p100.pager, activePage: p100.activePage, setup: p100.setup }))

console.log('DONE round-04')
