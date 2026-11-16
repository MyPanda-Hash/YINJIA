const task = await taskSpace('inv-proc-insp-20261114')
const page = task.page('p1')
// 刷新页面验证持久化(是)
await page.goto('http://127.0.0.1:8090/#/panelx/list/INV', { timeout: 30000 })
await page.reload({ waitUntil: 'load' }).catch(() => {})
await page.waitForTimeout(9000)
const persisted = await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body tbody tr')
  const tds = tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : []
  const tbText = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  return { flagIdx: tbText.findIndex((t) => t.startsWith('是否过程检验')), code: tds[2], flagCell: tds[6] }
})
console.log('PERSISTED:', JSON.stringify(persisted))
await page.screenshot({ path: 'C:/Users/vigna/ego/inv-proc-insp-20261114/round-09-persisted-yes.png' })
// 改回「否」并保存
const sel = '.el-table__body tbody tr:nth-child(1) td:nth-child(7)'
await page.click(`${sel} .cell-lazy`, { label: '点开是否过程检验格' })
await page.waitForTimeout(700)
const sw = await page.evaluate((s) => document.querySelector(s)?.querySelectorAll('.el-switch').length || 0, sel)
if (sw > 0) await page.click(`${sel} .el-switch`, { label: '切换回否' })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const span = [...document.querySelectorAll('span.act-name')].find((el) => (el.textContent || '').trim() === '保存')
  if (span) span.click()
})
await page.waitForTimeout(4000)
const back = await page.evaluate(() => ({
  messages: [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  cellText: (document.querySelector('.el-table__body tbody tr:nth-child(1) td:nth-child(7)')?.textContent || '').trim()
}))
console.log('REVERT:', JSON.stringify(back))
await page.screenshot({ path: 'C:/Users/vigna/ego/inv-proc-insp-20261114/round-09-reverted-no.png' })
