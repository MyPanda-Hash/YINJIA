// round-05:设置行已删 ⇒ 恢复默认全列;顺便验「锁定列拖不动」「普通列能拖」「取消不落库」
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(4500)
await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => !el.classList.contains('off')) || lines[0]
  if (hit) hit.click()
})
await page.waitForTimeout(3500)

const headers = () => page.evaluate(() => [...document.querySelectorAll('.el-table__header th .cell')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
const h0 = await headers()
console.log('默认表头:', JSON.stringify({ 列数: h0.length, 批号: h0.includes('批号'), 备注: h0.includes('备注'), 尾部: h0.slice(-4) }))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
  if (btn) btn.click()
})
await page.waitForTimeout(1000)

const order = () => page.evaluate(() => [...document.querySelectorAll('.csd-item')]
  .map((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim()))
const before = await order()

// ① 试着拖「客户」(锁定列)—— 应当纹丝不动
const lockedDrag = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.csd-item')]
  const row = rows.find((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim() === '客户')
  if (!row) return 'no-row'
  const r = row.getBoundingClientRect()
  const x = r.left + 60
  const y = r.top + r.height / 2
  const mk = (type, cy) => new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: cy, button: 0, pointerId: 1 })
  row.dispatchEvent(mk('pointerdown', y))
  window.dispatchEvent(mk('pointermove', y - 260))
  window.dispatchEvent(mk('pointerup', y - 260))
  return 'dragged'
})
await page.waitForTimeout(500)
const afterLocked = await order()
console.log('锁定列拖动:', lockedDrag, JSON.stringify({ 顺序变了: JSON.stringify(before) !== JSON.stringify(afterLocked), 客户位次: afterLocked.indexOf('客户') }))

// ② 拖「打印次数」到第 5 位(冻结区之后第一个非冻结位)—— 应当能换位
const movableDrag = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.csd-item')]
  const row = rows.find((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim() === '打印次数')
  const target = rows[4]
  if (!row || !target) return 'no-row'
  const r = row.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  const x = r.left + 60
  const y = r.top + r.height / 2
  const mk = (type, cy) => new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: cy, button: 0, pointerId: 1 })
  row.dispatchEvent(mk('pointerdown', y))
  window.dispatchEvent(mk('pointermove', t.top + 2))
  window.dispatchEvent(mk('pointerup', t.top + 2))
  return 'dragged'
})
await page.waitForTimeout(500)
const afterMove = await order()
console.log('普通列拖动:', movableDrag, JSON.stringify({ 打印次数位次: afterMove.indexOf('打印次数'), 第5项: afterMove[4] }))

// ③ 点「取消」→ 表格列序回到后端已保存那份(现在没有设置 ⇒ 默认顺序)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.csd-dialog .el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
const h1 = await headers()
console.log('取消后表头:', JSON.stringify({ 与默认一致: JSON.stringify(h1) === JSON.stringify(h0), 列数: h1.length }))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-05-default.png' })
