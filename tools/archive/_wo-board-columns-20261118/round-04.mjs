// round-04:核对已保存的设置(顺序/显隐确实落库) → 恢复默认并保存 → 表格回到全列默认顺序
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

const saved = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/reportColumnSettings?panelCode=WORK_ORDER_BOARD', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const j = await r.json()
  const d = j && (j.data || j)
  return d && d.columns ? {
    列数: d.columns.length,
    隐藏的列: d.columns.filter((c) => c.visible === false).map((c) => c.prop),
    尾部顺序: d.columns.slice(-6).map((c) => c.prop),
    打印次数下标: d.columns.findIndex((c) => c.prop === '打印次数'),
  } : d
})
console.log('后端已保存:', JSON.stringify(saved, null, 2))

const headers = () => page.evaluate(() => [...document.querySelectorAll('.el-table__header th .cell')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
console.log('当前表头尾部:', JSON.stringify((await headers()).slice(-6)))

// 恢复默认 → 保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
  if (btn) btn.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.csd-dialog .csd-bar button')].find((b) => (b.textContent || '').trim() === '恢复默认')
  if (btn) btn.click()
})
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-04-reset.png' })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.csd-dialog .el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(1500)

const restored = await headers()
console.log('恢复后表头:', JSON.stringify({
  批号: restored.includes('批号'),
  备注: restored.includes('备注'),
  列数: restored.length,
  尾部: restored.slice(-5),
}))
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => !el.classList.contains('off')) || lines[0]
  if (hit) hit.click()
})
await page.waitForTimeout(3500)
const afterReload = await headers()
console.log('刷新后表头:', JSON.stringify({ 批号: afterReload.includes('批号'), 备注: afterReload.includes('备注'), 列数: afterReload.length }))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-04-restored.png' })
