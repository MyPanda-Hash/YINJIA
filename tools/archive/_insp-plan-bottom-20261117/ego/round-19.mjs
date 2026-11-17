// round-19:在同一实例上直接调 colOptions(检测频率列),并打开下拉对照
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(9000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
const diag = await page.evaluate(() => {
  const el = document.querySelector('.rsp-dt-table') || document.querySelector('table.rs-dt')
  let c = el && el.__vueParentComponent
  let hops = 0
  while (c && hops < 30) {
    const st = c.setupState || {}
    if ('stdLibOpts' in st) break
    c = c.parent
    hops++
  }
  if (!c) return { found: false }
  const st = c.setupState
  const cfg = st.cfg
  const dt = (cfg.dataTables || []).find((d) => d.filterVal === '检验项目')
  const col = (dt.cols || []).find((x) => x.key === '检测频率')
  let opts = null
  try { opts = st.colOptions(col) } catch (e) { opts = 'err: ' + e.message }
  return {
    hops,
    panelCode: c.props ? c.props.panelCode : null,
    libKeys: Object.keys(st.stdLibOpts || {}),
    col,
    opts,
    sameLib: st.stdLibOpts && st.stdLibOpts[col.stdLib],
  }
})
console.log(JSON.stringify(diag, null, 2))
// 打开该行下拉
const box = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table.rs-dt tbody tr')].find((r) => r.querySelector('td.rs-td .el-select'))
  if (!tr) return null
  const td = [...tr.querySelectorAll('td.rs-td')].find((x) => x.querySelector('.el-select'))
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(1500) }
console.log(JSON.stringify(await page.evaluate(() => ({
  visibleOptions: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
})), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-19.png' })
