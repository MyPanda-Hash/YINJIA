// round-02:5173 上排查「本月」点击与取数
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
const state = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => ({
  url: location.href,
  title: document.querySelector('.iss-title')?.textContent?.trim() || '',
  quickChecked: [...document.querySelectorAll('.el-radio-button')].filter((n) => n.className.includes('is-active')).map((n) => (n.textContent || '').trim()),
  rangeInputs: [...document.querySelectorAll('.iss-range input')].map((i) => i.value),
  stats: [...document.querySelectorAll('.iss-stat b')].map((n) => (n.textContent || '').trim()),
  error: document.querySelector('.iss-alert')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  rows: document.querySelectorAll('.iss-table .el-table__body-wrapper tbody tr').length,
}))))

await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)
await state('A')
await page.evaluate(() => {
  const inner = [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))
  inner?.click()
})
await page.waitForTimeout(3000)
await state('B')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/06-5173-month.png` })
await task.finish({ keep: [] })
