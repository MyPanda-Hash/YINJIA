/* round-09.mjs — 复核:三个链上单号在最右、三个行号已隐藏 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(9000)

const th = await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__header th')]
    .map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim()).filter(Boolean))
console.log('8090 表头 ->', JSON.stringify(th, null, 0))
console.log('含「行号」的列 ->', JSON.stringify(th.filter((t) => t.includes('行号'))))
console.log('最后 4 列 ->', JSON.stringify(th.slice(-4)))
