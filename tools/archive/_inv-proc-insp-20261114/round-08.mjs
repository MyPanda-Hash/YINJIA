const task = await taskSpace('inv-proc-insp-20261114')
const page = task.page('p1')
const sel = '.el-table__body tbody tr:nth-child(1) td:nth-child(7)'
// ① 点开单元格(激活开关)
await page.click(`${sel} .cell-lazy`, { label: '点开是否过程检验格' })
await page.waitForTimeout(700)
const step1 = await page.evaluate((s) => {
  const td = document.querySelector(s)
  return { text: (td.textContent || '').trim(), switches: td.querySelectorAll('.el-switch').length, html: td.innerHTML.slice(0, 300) }
}, sel)
console.log('STEP1 activate:', JSON.stringify(step1))
// ② 点开关 → 是
if (step1.switches > 0) {
  await page.click(`${sel} .el-switch`, { label: '切换为是' })
  await page.waitForTimeout(700)
}
const step2 = await page.evaluate((s) => {
  const td = document.querySelector(s)
  return { text: (td.textContent || '').trim(), checked: td.querySelector('.el-switch')?.classList.contains('is-checked'), html: td.innerHTML.slice(0, 300) }
}, sel)
console.log('STEP2 toggle:', JSON.stringify(step2))
// ③ 保存
const saved = await page.evaluate(() => {
  const span = [...document.querySelectorAll('span.act-name')].find((el) => (el.textContent || '').trim() === '保存')
  if (!span) return { clicked: false }
  span.click()
  return { clicked: true }
})
await page.waitForTimeout(4000)
const afterSave = await page.evaluate(() => ({
  messages: [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  cellText: (document.querySelector('.el-table__body tbody tr:nth-child(1) td:nth-child(7)')?.textContent || '').trim()
}))
console.log('STEP3 save:', JSON.stringify(saved), JSON.stringify(afterSave))
await page.screenshot({ path: 'C:/Users/vigna/ego/inv-proc-insp-20261114/round-08.png' })
