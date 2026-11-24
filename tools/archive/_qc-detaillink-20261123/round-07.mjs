// round-07.mjs —— 探:明细表点「单据编号」排序器后表格状态(round-06 首行读成空串)
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const ASM = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'
await page.goto(ASM, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(ASM, { timeout: 30000 })
}
for (let i = 0; i < 25; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}
const before = await page.evaluate(() => {
  const tr = document.querySelector('.report-table .el-table__body tr')
  return { rows: document.querySelectorAll('.report-table .el-table__body tr').length, cls: tr?.className || '', text: (tr?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) }
})
await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const th = [...table.querySelectorAll('.el-table__header th')].find((x) => (x.innerText || '').includes('单据编号'))
  th?.querySelector('.report-col-sorter')?.click()
})
await page.waitForTimeout(6000)
const after = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const rows = [...table.querySelectorAll('.el-table__body tr')]
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  return {
    rows: rows.length,
    heads,
    firstRowCls: rows[0]?.className || '',
    firstRowCells: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').trim()).slice(0, 8) : [],
    firstRowHtml: (rows[0]?.outerHTML || '').slice(0, 400),
    bodyH: table.querySelector('.el-table__body-wrapper')?.scrollHeight || 0,
  }
})
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-07-sorted-probe.png' })
console.log(JSON.stringify({ before, after }, null, 2))
await task.finish({ keep: [] })
