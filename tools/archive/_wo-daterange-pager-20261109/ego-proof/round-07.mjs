// round-07.mjs — 验收第 7 轮:清单 5 订单结转页回归 + 清单 2 干净截图(鼠标移开侧栏,避免扫码菜单浮层)
// 只读:只查询/开关面板,不点转工单/保存交期等写操作
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const WO = 'http://localhost:5173/#/prod/plan/workOrderList'
const OC = 'http://localhost:5173/#/prod/plan/orderConvert'

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
async function moveAway() {
  try { await page.mouse.move(760, 660) } catch (e) {}
  await page.waitForTimeout(700)
}
const woState = () => page.evaluate(() => {
  const q = document.querySelector('.wol-query')
  const table = document.querySelector('.wol-table')
  const pag = document.querySelector('.wol-pager .el-pagination')
  return {
    hash: location.hash,
    inputs: q ? [...q.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, v: i.value })) : [],
    countText: (document.querySelector('.wol-count') || {}).innerText,
    rows: table ? table.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
  }
})

// ── A. 生产工单页:清单 2 的干净前后对照截图 ──
await page.goto(WO, { timeout: 40000 })
await page.waitForTimeout(5000)
await installConsoleHook()
await moveAway()
const woBefore = await woState()
console.log('WO before shortcut: ' + JSON.stringify({ count: woBefore.countText, inputs: woBefore.inputs, rows: woBefore.rows }))

// 点开面板截图(清单 1 补充证据,无侧栏浮层)
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(1000)
const woShortcuts = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel__shortcut')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-wo-picker-panel.png' })
// 先点「近 7 天」
await page.click('text=近 7 天')
await page.waitForTimeout(5000)
await moveAway()
const wo7 = await woState()
console.log('WO after 近7天: ' + JSON.stringify({ count: wo7.countText, inputs: wo7.inputs, rows: wo7.rows }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-wo-7d.png' })
// 再点「近 30 天」
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(900)
await page.click('text=近 30 天')
await page.waitForTimeout(6000)
await moveAway()
const wo30 = await woState()
console.log('WO after 近30天: ' + JSON.stringify({ count: wo30.countText, inputs: wo30.inputs, rows: wo30.rows }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-wo-30d.png' })
console.log('WO shortcuts list: ' + JSON.stringify(woShortcuts))
const woConsole = await page.evaluate(() => ({ errs: window.__errs.slice(), warnCount: window.__warns.length, warnSample: window.__warns.slice(0, 8) }))
console.log('WO console: ' + JSON.stringify(woConsole, null, 2))

// ── B. 订单结转页回归(清单 5) ──
await page.goto(OC, { timeout: 40000 })
await page.waitForTimeout(6000)
await installConsoleHook()
await moveAway()
async function ocState() {
  return page.evaluate(() => {
    const bar = document.querySelector('.oc-bar')
    const drq = document.querySelector('.oc-bar .drq-picker')
    const table = document.querySelector('.oc-table .el-table')
    const pag = document.querySelector('.oc-pager .el-pagination')
    const pageEl = document.querySelector('.oc-page')
    const ss = pageEl && pageEl.__vueParentComponent && pageEl.__vueParentComponent.setupState
    const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
    const emptyText = table ? (table.querySelector('.el-table__empty-text') || {}).innerText : null
    return {
      hash: location.hash,
      hasPage: !!pageEl,
      barInputs: bar ? [...bar.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, v: i.value, cls: String(i.className).slice(0, 40) })) : [],
      hasDrq: !!drq,
      drqCls: drq ? drq.className : null,
      drqWidth: drq ? Math.round(drq.getBoundingClientRect().width) : null,
      drqInlineStyle: drq ? (drq.style.width || null) : null,
      countText: (document.querySelector('.oc-count') || {}).innerText,
      rows: trs.length,
      firstRow: trs[0] ? (trs[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      emptyText,
      pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
      setup: ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || [])), range: JSON.parse(JSON.stringify(ss.range || {})), rangeText: ss.rangeText, pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length } : null,
      errs: window.__errs ? window.__errs.slice() : null,
    }
  })
}
const oc = await ocState()
console.log('OC default: ' + JSON.stringify({ count: oc.countText, rows: oc.rows, inputs: oc.barInputs, hasDrq: oc.hasDrq, drqWidth: oc.drqWidth, drqInline: oc.drqInlineStyle, pager: oc.pager, setup: oc.setup, emptyText: oc.emptyText, firstRow: oc.firstRow }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-oc-default.png' })

// 点开面板 → 快捷档
await page.click('.oc-bar .drq-picker')
await page.waitForTimeout(1000)
const ocShortcuts = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel__shortcut')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-oc-picker-panel.png' })
// 关面板
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await moveAway()

// 点「查询」→ 数据/空表提示正常
await page.click('text="查询"')
await page.waitForTimeout(4000)
await moveAway()
const ocAfterQuery = await ocState()
console.log('OC after 查询: ' + JSON.stringify({ count: ocAfterQuery.countText, rows: ocAfterQuery.rows, emptyText: ocAfterQuery.emptyText, pager: ocAfterQuery.pager, setup: ocAfterQuery.setup }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-oc-query.png' })

// 快捷档「近 30 天」在订单结转页也能用(行为与抽取前一致)
await page.click('.oc-bar .drq-picker')
await page.waitForTimeout(900)
await page.click('text=近 30 天')
await page.waitForTimeout(5000)
await moveAway()
const oc30 = await ocState()
console.log('OC after 近30天: ' + JSON.stringify({ count: oc30.countText, rows: oc30.rows, inputs: oc30.barInputs, setup: oc30.setup, pager: oc30.pager }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-07-oc-30d.png' })

// 清单 7:两页控制台报错汇总
const consoleInfo = await page.evaluate(() => ({ errs: window.__errs.slice(), warnCount: window.__warns.length, warnSample: window.__warns.slice(0, 8) }))
console.log('OC console: ' + JSON.stringify(consoleInfo, null, 2))
console.log('OC shortcuts list: ' + JSON.stringify(ocShortcuts))
console.log('DONE round-07')
