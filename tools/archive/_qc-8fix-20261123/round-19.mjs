// round-19: 验证 提交时间(含时分) + 看板检验状态筛选
const task = await taskSpace('qc-8fix-20261123')
const page = await task.page('p1')
// ① QC_BHC 时间
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(7000)
for (const no of ['BHC-2026-11-0002', 'BHC-2026-11-0001', 'BHC-2026-09-0001']) {
  await page.evaluate((no) => {
    const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes(no))
    if (tr) tr.click()
  }, no)
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => ({
    infoRows: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
    signValues: [...document.querySelectorAll('.q-sign-name, .q-sign-val')].map((x) => (x.innerText || '').trim()).filter(Boolean),
  }))
  console.log(no, JSON.stringify(info))
}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-19-bhc-time.png' })

// ② 进度看板筛选
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log('board:', JSON.stringify(await page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim(),
})), null, 1))
// 选「未检验」
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.wpb-controls .el-select')].find((s) => (s.innerText || '').includes('全部检验'))
  if (sel) sel.click()
})
await page.waitForTimeout(800)
const opt = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((x) => (x.innerText || '').trim() === '未检验')
  if (hit) { hit.click(); return true }
  return items.map((x) => (x.innerText || '').trim()).slice(0, 8)
})
console.log('select 未检验:', JSON.stringify(opt))
await page.waitForTimeout(4000)
console.log('after filter:', JSON.stringify(await page.evaluate(() => ({
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim(),
  rows: document.querySelectorAll('.wpb-grid-row').length,
  firstRows: [...document.querySelectorAll('.wpb-grid-row')].slice(0, 3).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100)),
})), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-19-board.png' })
