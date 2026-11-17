// round-13：5173 删除刚建的测试工单（验证删除链路 + 提示原文）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
const rowNo = await page.evaluate(() => (document.querySelector('.wol-table .el-table__body tr') || {}).textContent?.match(/GD-\d{4}-\d{2}-\d{4}/)?.[0] || '')
console.log('当前行工单=' + rowNo)
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(700)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '删除工单')
  btn?.click()
})
await sleep(1300)
const confirmText = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
  return b ? (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 320) : null
})
console.log('确认框=' + JSON.stringify(confirmText))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
  const btn = b ? [...b.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '确认') : null
  btn?.click()
})
let msgs = []
for (let i = 0; i < 18; i++) {
  await sleep(350)
  msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  if (msgs.length) break
}
await sleep(1500)
console.log('删除提示=' + JSON.stringify(msgs))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r13-5173-deleted.png' })
console.log('pageerrors=' + JSON.stringify(errors))
console.log('待物理清理工单号=' + rowNo)
