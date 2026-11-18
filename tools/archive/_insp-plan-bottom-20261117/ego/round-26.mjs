// round-26:新行继承 + 下拉顺序(seq) —— 全部读组件行模型取证,不落库
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
// 取组件实例上的 rowsOf / cfg
const info = await page.evaluate(() => {
  const el = document.querySelector('.rsp-dt-table')
  let c = el && el.__vueParentComponent
  let hops = 0
  while (c && hops < 30 && !('rowsOf' in (c.setupState || {}))) { c = c.parent; hops++ }
  if (!c) return { found: false }
  const st = c.setupState
  const dt = (st.cfg.dataTables || []).find((d) => d.filterVal === '检验项目')
  window.__st = st
  window.__dt = dt
  return {
    found: true,
    rows: st.rowsOf(dt).length,
    footerField: dt.footerField,
    freqOpts: st.stdLibOpts['INSP_FREQ_OQC'],
  }
})
console.log('state:', JSON.stringify(info, null, 2))
// 1) 先填合并格文本
await page.evaluate(() => {
  const setVal = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const ff = document.querySelector('.rsp-footer-field textarea')
  if (ff) setVal(ff, '【共享】暂停生产并隔离')
})
await page.waitForTimeout(600)
// 2) 再加两行 → 应继承上面的文本
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(600)
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => {
  const st = window.__st
  const dt = window.__dt
  const rows = st.rowsOf(dt)
  return {
    rows: rows.length,
    measures: rows.map((r) => r['不合格应对措施']),
  }
}), null, 2))
// 3) 打开下拉看顺序
try {
  await page.click('table.rs-dt td.rs-td .el-select .el-select__wrapper', { label: '打开检查频率下拉' })
} catch (e) { console.log('click err: ' + e.message) }
await page.waitForTimeout(900)
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-26-dropdown.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  options: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
})), null, 2))
