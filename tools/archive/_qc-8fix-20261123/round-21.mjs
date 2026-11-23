// round-21: 看板 检验状态筛选(全部/未检验/已检验) 实际生效验证
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 60000 })
await page.waitForTimeout(9000)
const pick = async (label) => {
  const ok = await page.evaluate((label) => {
    const sel = [...document.querySelectorAll('.wpb-controls .el-select')].find((s) => (s.innerText || '').includes(label))
    if (sel) sel.click()
    return !!sel
  }, label)
  await page.waitForTimeout(600)
  const hit = await page.evaluate((label) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((x) => (x.innerText || '').trim() === label)
    if (target) { target.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(4000)
  return { ok, hit }
}
const snap = () => page.evaluate(() => ({
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim(),
  rows: document.querySelectorAll('.wpb-grid-row').length,
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('initial:', JSON.stringify(await snap()))
console.log('status全部:', JSON.stringify(await pick('全部')))
console.log('after status 全部:', JSON.stringify(await snap()))
console.log('qc已检验:', JSON.stringify(await pick('已检验')))
console.log('after 已检验:', JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-21-inspected.png' })
console.log('qc未检验:', JSON.stringify(await pick('未检验')))
console.log('after 未检验:', JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-21-uninspected.png' })
