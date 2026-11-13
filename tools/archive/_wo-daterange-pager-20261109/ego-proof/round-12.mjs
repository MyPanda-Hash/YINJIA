// round-12.mjs — T5 回归抽检:分页(8 页@50)/翻页/筛选与刷新回第1页/跨页勾选/快捷档/订单结转页(默认[今天,今天]+宽260)
// 只读:查询/翻页/筛选/勾选(已取消)/开关面板,不点任何写操作
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const WO = 'http://localhost:5173/#/prod/plan/workOrderList'
const OC = 'http://localhost:5173/#/prod/plan/orderConvert'

const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed page=' + page.label + ' hash=' + (await page.evaluate(() => location.hash)))
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function moveAway() { try { await page.mouse.move(760, 660) } catch (e) {} await page.waitForTimeout(500) }
async function installConsoleHook() {
  await page.evaluate(() => {
    window.__errs = []
    window.__warns = []
    const oe = console.error.bind(console)
    console.error = (...a) => { window.__errs.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 400)); return oe(...a) }
    const ow = console.warn.bind(console)
    console.warn = (...a) => { window.__warns.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ').slice(0, 200)); return ow(...a) }
    window.addEventListener('error', (e) => window.__errs.push('window.error: ' + (e.message || '')))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('unhandledrejection: ' + String((e.reason && e.reason.message) || e.reason).slice(0, 300)))
  })
}
const woState = () => page.evaluate(() => {
  const table = document.querySelector('.wol-table')
  const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  const pag = document.querySelector('.wol-pager .el-pagination')
  const pageEl = document.querySelector('.wol-page')
  const ss = pageEl && pageEl.__vueParentComponent.setupState
  const btn = (txt) => { const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === txt); return b ? { disabled: b.disabled } : null }
  return {
    hash: location.hash,
    rows: trs.length,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    firstRow: trs[0] ? (trs[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : null,
    lastRow: trs.length ? (trs[trs.length - 1].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : null,
    countText: (document.querySelector('.wol-count') || {}).innerText,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    pageBtns: pag ? [...pag.querySelectorAll('.el-pager li')].map((li) => (li.innerText || '').trim()) : null,
    activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
    setup: ss ? { stateFilter: ss.stateFilter, pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length, checkedLen: ss.checked.length } : null,
    closeBtn: btn('结案'),
    errs: window.__errs ? window.__errs.slice() : null,
    warnCount: window.__warns ? window.__warns.length : null,
  }
})
async function waitStable(ms = 2600) { await page.waitForTimeout(ms) }

// 起手状态(round-11 sample3 留下的:大范围 399 条 / 50 行每页 / 第 1 页)
await page.keyboard.press('Escape').catch(() => {})
await installConsoleHook()
const s0 = await woState()
console.log('STATE at start: ' + JSON.stringify({ rows: s0.rows, ths: s0.ths, countText: s0.countText, pager: s0.pager, pageBtns: s0.pageBtns, activePage: s0.activePage, setup: s0.setup, firstRow: s0.firstRow }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-state-wide-50.png' })

// ── 1) 分页:总页数=8、第2页/第8页行数与首行、回第1页 ──
const page1Keys = await page.evaluate(() => [...document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)))
async function clickPagerPage(n) {
  const t = Date.now()
  const idx = await page.evaluate((n) => [...document.querySelectorAll('.wol-pager .el-pager li')].findIndex((li) => (li.innerText || '').trim() === String(n)), n)
  if (idx < 0) return { error: 'page li ' + n + ' not found', btns: await page.evaluate(() => [...document.querySelectorAll('.wol-pager .el-pager li')].map((li) => (li.innerText || '').trim())) }
  await page.click(`.wol-pager .el-pager li >> nth=${idx}`)
  await waitStable(2600)
  const s = await woState()
  return { wall: Date.now() - t, activePage: s.activePage, rows: s.rows, firstRow: s.firstRow, lastRow: s.lastRow }
}
const p2 = await clickPagerPage(2)
console.log('PAGE2: ' + JSON.stringify(p2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-pagination-page2.png' })
const p8 = await clickPagerPage(8)
console.log('PAGE8: ' + JSON.stringify(p8))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-pagination-page8.png' })
const pBack = await clickPagerPage(1)
const pBackFirst = await page.evaluate(() => { const tr = document.querySelector('.wol-table .el-table__body-wrapper tbody tr'); return tr ? (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : null })
console.log('PAGE1-BACK: ' + JSON.stringify({ ...pBack, sameFirstAsStart: pBackFirst === s0.firstRow, rowsOverlap: (await page.evaluate(() => [...document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr')].map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)))).filter((k) => page1Keys.includes(k)).length }))

// ── 2) 筛选/刷新回第 1 页 ──
await clickPagerPage(2)
console.log('before filter: ' + JSON.stringify(await woState().then((s) => ({ activePage: s.activePage, pageNo: s.setup.pageNo }))))
await page.click('.wol-line .el-radio-button >> nth=1') // 未完工
await waitStable(3000)
const f1 = await woState()
console.log('FILTER 未完工: ' + JSON.stringify({ activePage: f1.activePage, pageNo: f1.setup.pageNo, stateFilter: f1.setup.stateFilter, filteredLen: f1.setup.filteredLen, rows: f1.rows, pager: f1.pager }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-filter-unfinished.png' })
await page.click('.wol-line .el-radio-button >> nth=2') // 已完工
await waitStable(3000)
const f2 = await woState()
console.log('FILTER 已完工: ' + JSON.stringify({ activePage: f2.activePage, pageNo: f2.setup.pageNo, stateFilter: f2.setup.stateFilter, filteredLen: f2.setup.filteredLen, rows: f2.rows, pager: f2.pager }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-filter-finished.png' })
await page.click('.wol-line .el-radio-button >> nth=0') // 全部
await waitStable(3000)
const f3 = await woState()
console.log('FILTER 全部: ' + JSON.stringify({ activePage: f3.activePage, pageNo: f3.setup.pageNo, stateFilter: f3.setup.stateFilter, filteredLen: f3.setup.filteredLen, rows: f3.rows }))
await clickPagerPage(2)
await page.click('text="刷新"')
const tRefresh = Date.now()
await waitStable(4500)
const r = await woState()
console.log('REFRESH from page2: ' + JSON.stringify({ wall: Date.now() - tRefresh, activePage: r.activePage, pageNo: r.setup.pageNo, rows: r.rows, firstRow: (r.firstRow || '').slice(0, 30), pager: r.pager }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-refresh-back-page1.png' })

// ── 3) 跨页勾选 ──
const pre = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, checkedLen: ss.checked.length, closeDisabled: b ? b.disabled : null }
})
await page.click('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
await page.waitForTimeout(800)
const c1 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  const cb = document.querySelector('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
  return { checkedLen: ss.checked.length, keys: ss.checked.map((x) => x['加工单号'] + '#' + x['行号']), closeDisabled: b ? b.disabled : null, cbCls: cb ? cb.className : null, activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText }
})
console.log('SELECT page1: ' + JSON.stringify({ pre, c1 }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-selection-page1.png' })
await clickPagerPage(2)
const c2 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, checkedLen: ss.checked.length, keys: ss.checked.map((x) => x['加工单号'] + '#' + x['行号']) }
})
console.log('SELECT on page2: ' + JSON.stringify(c2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-selection-page2.png' })
await clickPagerPage(1)
const c3 = await page.evaluate(() => {
  const ss = document.querySelector('.wol-page').__vueParentComponent.setupState
  const cb = document.querySelector('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
  const b = [...document.querySelectorAll('.wol-btns .el-button')].find((x) => (x.innerText || '').trim() === '结案')
  return { activePage: (document.querySelector('.wol-pager .el-pager li.is-active') || {}).innerText, checkedLen: ss.checked.length, keys: ss.checked.map((x) => x['加工单号'] + '#' + x['行号']), cbCls: cb ? cb.className : null, closeDisabled: b ? b.disabled : null }
})
console.log('SELECT back page1: ' + JSON.stringify(c3))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-selection-back-page1.png' })
await page.click('.wol-table .el-table__body-wrapper tbody tr:first-child .el-checkbox')
await page.waitForTimeout(600)
console.log('SELECT cleared: ' + JSON.stringify(await page.evaluate(() => ({ checkedLen: document.querySelector('.wol-page').__vueParentComponent.setupState.checked.length }))))

// ── 4) 快捷档(近 30 天)→ 条数变化 ──
const beforeShortcut = await woState()
await page.click('.wol-query .el-date-editor')
await page.waitForTimeout(900)
const shortcuts = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel__shortcut')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
await page.click('text=近 30 天')
await waitStable(3500)
await moveAway()
const afterShortcut = await woState()
console.log('SHORTCUT 近30天: ' + JSON.stringify({ shortcuts, before: { count: beforeShortcut.countText, rows: beforeShortcut.rows }, after: { count: afterShortcut.countText, rows: afterShortcut.rows, pager: afterShortcut.pager, activePage: afterShortcut.activePage } }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-shortcut-30d.png' })

// ── 5) 订单结转页回归(默认 [今天,今天] + 宽 260 + 快捷档) ──
await page.goto(OC, { timeout: 40000 })
await page.waitForTimeout(6000)
await moveAway()
const ocDialogs = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)))
if (ocDialogs.length) { await page.click('text="留在本日"'); await page.waitForTimeout(800) }
const ocState = () => page.evaluate(() => {
  const bar = document.querySelector('.oc-bar')
  const drq = document.querySelector('.oc-bar .el-date-editor')
  const table = document.querySelector('.oc-table .el-table')
  const pag = document.querySelector('.oc-pager .el-pagination')
  const pageEl = document.querySelector('.oc-page')
  const ss = pageEl && pageEl.__vueParentComponent && pageEl.__vueParentComponent.setupState
  const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  return {
    hash: location.hash,
    hasDrq: !!drq,
    drqWidth: drq ? Math.round(drq.getBoundingClientRect().width) : null,
    drqInline: drq ? (drq.getAttribute('style') || null) : null,
    placeholders: bar ? [...bar.querySelectorAll('.el-range-input')].map((i) => i.placeholder) : [],
    barInputs: bar ? [...bar.querySelectorAll('.el-range-input')].map((i) => i.value) : [],
    countText: (document.querySelector('.oc-count') || {}).innerText,
    rows: trs.length,
    emptyText: table ? (table.querySelector('.el-table__empty-text') || {}).innerText : null,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    setup: ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || [])), range: JSON.parse(JSON.stringify(ss.range || {})), pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length } : null,
    dialogs: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
    errs: window.__errs ? window.__errs.slice() : null,
  }
})
const oc0 = await ocState()
console.log('OC DEFAULT: ' + JSON.stringify({ hash: oc0.hash, drqWidth: oc0.drqWidth, drqInline: oc0.drqInline, placeholders: oc0.placeholders, barInputs: oc0.barInputs, countText: oc0.countText, rows: oc0.rows, emptyText: oc0.emptyText, pager: oc0.pager, setup: oc0.setup }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-oc-default.png' })
// 快捷档面板
await page.click('.oc-bar .el-date-editor')
await page.waitForTimeout(1000)
const ocShortcuts = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel__shortcut')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-oc-picker-panel.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
// 近 30 天 → 有数据
await page.click('.oc-bar .el-date-editor')
await page.waitForTimeout(900)
await page.click('text=近 30 天')
await page.waitForTimeout(5000)
await moveAway()
const oc30 = await ocState()
console.log('OC 近30天: ' + JSON.stringify({ shortcuts: ocShortcuts, countText: oc30.countText, rows: oc30.rows, barInputs: oc30.barInputs, drqWidth: oc30.drqWidth, pager: oc30.pager, setup: oc30.setup, dialogs: oc30.dialogs }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-12-oc-30d.png' })

// ── 6) 控制台报错汇总 ──
const consoleInfo = await page.evaluate(() => ({ errs: window.__errs ? window.__errs.slice() : 'no hook', warnCount: window.__warns ? window.__warns.length : null, warnSample: window.__warns ? window.__warns.slice(0, 6) : null }))
console.log('CONSOLE: ' + JSON.stringify(consoleInfo, null, 2))
console.log('DONE round-12')
