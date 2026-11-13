// round-08b.mjs — 验收第 7 轮续:订单结转页(清单 5)——关掉「没有数据」确认框后验控件/快捷档/查询
// 只读:只点「留在本日」(取消,非写操作)/查询/快捷档
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })
const OC = 'http://localhost:5173/#/prod/plan/orderConvert'

const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed page=' + page.label + ' hash=' + (await page.evaluate(() => location.hash)))
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const ocState = () => page.evaluate(() => {
  const bar = document.querySelector('.oc-bar')
  const drq = document.querySelector('.oc-bar .drq-picker')
  const table = document.querySelector('.oc-table .el-table')
  const pag = document.querySelector('.oc-pager .el-pagination')
  const pageEl = document.querySelector('.oc-page')
  const ss = pageEl && pageEl.__vueParentComponent && pageEl.__vueParentComponent.setupState
  const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  return {
    hash: location.hash,
    barInputs: bar ? [...bar.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, v: i.value })) : [],
    hasDrq: !!drq, drqWidth: drq ? Math.round(drq.getBoundingClientRect().width) : null,
    countText: (document.querySelector('.oc-count') || {}).innerText,
    rows: trs.length,
    firstRow: trs[0] ? (trs[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    dialog: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160)),
    setup: ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || [])), range: JSON.parse(JSON.stringify(ss.range || {})), pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length } : null,
  }
})

// 1) 关掉自动弹出的「没有数据」确认框(点取消「留在本日」)
const dialogsBefore = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('dialogs on entry: ' + JSON.stringify(dialogsBefore))
if (dialogsBefore.length) {
  await page.click('text="留在本日"')
  await page.waitForTimeout(800)
  console.log('dismissed via 留在本日; dialogs now=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetParent !== null).length)))
}

// 2) 组件级取证:确认两页用的是同一个 DateRangeQuery 组件(读组件实例名 + props)
const compInfo = await page.evaluate(() => {
  const el = document.querySelector('.oc-bar .drq-picker')
  const chain = []
  let c = el && el.__vueParentComponent
  let dq = null
  for (let i = 0; i < 15 && c; i++, c = c.parent) {
    const nm = c.type && (c.type.__name || c.type.name || (typeof c.type === 'string' ? c.type : null))
    chain.push(nm || 'anonymous')
    if (nm === 'DateRangeQuery' && !dq) {
      const p = c.props || {}
      dq = { modelValue: JSON.parse(JSON.stringify(p.modelValue ?? null)), clearable: p.clearable, hasShortcuts: !!(c.setupState && c.setupState.shortcuts) }
    }
  }
  return { chain, dq }
})
console.log('OC component chain: ' + JSON.stringify(compInfo, null, 2))

// 3) 默认态截图 + 控件占位
const ocDefault = await ocState()
console.log('OC default(after dialog dismissed): ' + JSON.stringify({ count: ocDefault.countText, rows: ocDefault.rows, inputs: ocDefault.barInputs, setup: ocDefault.setup, pager: ocDefault.pager }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-08b-oc-default.png' })

// 4) 点开面板 → 快捷档 + 截图
await page.click('.oc-bar .drq-picker')
await page.waitForTimeout(1000)
const shortcuts = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('.el-picker-panel')].filter((p) => p.offsetParent !== null)
  const p = panels[panels.length - 1]
  return p ? [...p.querySelectorAll('.el-picker-panel__shortcut')].map((b) => (b.innerText || '').trim()) : null
})
console.log('OC shortcuts: ' + JSON.stringify(shortcuts))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-08b-oc-picker-panel.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// 5) 点「查询」→ 空区间应给空表提示 + 确认框(与改前一致)
await page.click('text="查询"')
await page.waitForTimeout(4000)
const ocQuery = await ocState()
console.log('OC after 查询 (空区间): ' + JSON.stringify({ count: ocQuery.countText, rows: ocQuery.rows, dialog: ocQuery.dialog, pager: ocQuery.pager }, null, 2))
if (ocQuery.dialog && ocQuery.dialog.length) {
  await page.click('text="留在本日"')
  await page.waitForTimeout(600)
}

// 6) 快捷档「近 30 天」→ 查数据(有数据时正常)
await page.click('.oc-bar .drq-picker')
await page.waitForTimeout(900)
await page.click('text=近 30 天')
await page.waitForTimeout(6000)
try { await page.mouse.move(760, 660) } catch (e) {}
await page.waitForTimeout(600)
const oc30 = await ocState()
console.log('OC after 近30天: ' + JSON.stringify({ count: oc30.countText, rows: oc30.rows, inputs: oc30.barInputs, setup: oc30.setup, pager: oc30.pager, firstRow: oc30.firstRow, dialog: oc30.dialog }, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-08b-oc-30d.png' })

// 7) 控制台
const consoleInfo = await page.evaluate(() => ({ errs: window.__errs ? window.__errs.slice() : 'no hook', warnCount: window.__warns ? window.__warns.length : null }))
console.log('OC console: ' + JSON.stringify(consoleInfo, null, 2))
console.log('DONE round-08b')
