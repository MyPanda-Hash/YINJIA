/* round-08.mjs — 四组「单号 + 行号」分列复核 + 找那条行号不一致的真实数据(正式库 8090) */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(9000)

const th = await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__header th')]
    .map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim()).filter(Boolean))
console.log('8090 表头 ->', JSON.stringify(th))

// 勾上「显示全部状态」再按 检验数据记录单号 找 JYSJ-2026-10-0081(检验单行1 / 暂收行6 的那条)
await page.evaluate(() => {
  const cb = document.querySelector('.gated-toggle input[type=checkbox]') || document.querySelector('.gated-toggle')
  if (cb) cb.click()
})
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.toolbar-query-btn')].find((x) => /条件/.test(x.innerText || ''))
  if (b) b.click()
})
await page.waitForTimeout(1200)

const rows = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return bodyRows.slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
})
console.log('前 5 行(前 13 列) ->', JSON.stringify(rows.map((r) => r.slice(0, 13)), null, 2))
