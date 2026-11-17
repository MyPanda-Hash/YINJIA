// round-24:用 ego 的真实 click 打开下拉,先截图再看候选
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(2000)
try {
  await page.click('table.rs-dt td.rs-td .el-select .el-select__wrapper', { label: '打开检查频率下拉' })
} catch (e) {
  console.log('click err: ' + e.message)
}
await page.waitForTimeout(800)
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-24.png' })
console.log(JSON.stringify(await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const vis = items.filter((e) => e.getBoundingClientRect().height > 0)
  return { total: items.length, visibleTexts: vis.map((e) => (e.textContent || '').trim()), allTexts: items.map((e) => (e.textContent || '').trim()) }
}), null, 2))
