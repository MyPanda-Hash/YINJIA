// round-02:逐个点击「已完成 / 未完成 / 全部」,核对条数、行状态与翻页;并验证别的面板左栏无页签
const OUT = 'C:/Users/vigna/ego/oqc-rail-tabs-20261110'
const task = await taskSpace('oqc-rail-tabs-20261110')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rail = q('.doc-select-rail')
  const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')] : []
  return {
    hash: location.hash,
    railTitle: txt(q('.dsr-head .dsr-title')),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    pager: txt(q('.drail-pager')) || txt(q('[class*="pager"]')),
    rowCount: rows.length,
    tagCounts: (rail ? [...rail.querySelectorAll('.dsr-grid tbody .dsr-tag')] : []).reduce((a, el) => { const k = el.textContent.trim(); a[k] = (a[k] || 0) + 1; return a }, {}),
    noRail: !rail,
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

const clickTab = async (label) => {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === t)
    if (b) b.click()
  }, label)
  await page.waitForTimeout(2500)
}

// ---- 已完成 ----
await clickTab('已完成')
const done = await probe()
console.log('DONE_TAB=' + JSON.stringify(done))
await shot('round-02-tab-done')

// 已完成第 2 页:确认服务端过滤跨页仍全是已审核
const nextOk = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.page-btn,[class*="page-btn"]')].find((x) => (x.getAttribute('title') || '').includes('下一页') && x.textContent.includes('▶'))
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(2500)
console.log('DONE_PAGE2=' + JSON.stringify({ nextOk, ...(await probe()) }))
await shot('round-02-tab-done-page2')

// ---- 未完成 ----
await clickTab('未完成')
console.log('TODO_TAB=' + JSON.stringify(await probe()))
await shot('round-02-tab-todo')

// ---- 回到全部 ----
await clickTab('全部')
console.log('ALL_TAB=' + JSON.stringify(await probe()))
await shot('round-02-tab-all')

// ---- 别的带左栏面板:确认没有页签(用户口径:不要修改其他页面的这个组件)----
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('QC_INSP=' + JSON.stringify(await probe()))
await shot('round-02-other-panel-qc-insp')

await page.goto('http://localhost:5173/#/panelx/list/QC_OQC_REPORT', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('QC_OQC_REPORT=' + JSON.stringify(await probe()))
await shot('round-02-other-panel-qc-oqc-report')

// 日语界面下页签是否已译(切语言后看页签文字)
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(2500)
console.log('BACK=' + JSON.stringify(await probe()))
