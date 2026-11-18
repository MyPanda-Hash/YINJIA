// round-03:取消勾选「批号」「备注」+ 把「打印次数」上移两位 → 保存 → 看表格列变化 → 刷新后仍生效
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

const headers = () => page.evaluate(() => [...document.querySelectorAll('.el-table__header th .cell')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
const openDialog = () => page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
  if (btn) btn.click()
  return !!btn
})
const rowIdx = (label) => `(function(){
  const rows = [...document.querySelectorAll('.csd-item')]
  return rows.findIndex((el) => ((el.querySelector('.csd-label')||{}).textContent||'').trim() === ${JSON.stringify(label)})
})()`

const dlgOpen = await page.evaluate(() => !!document.querySelector('.csd-dialog .csd-list'))
if (!dlgOpen) await openDialog()
await page.waitForTimeout(800)

// ① 取消勾选「批号」「备注」
const unchecked = await page.evaluate(() => {
  const out = []
  for (const label of ['批号', '备注']) {
    const row = [...document.querySelectorAll('.csd-item')]
      .find((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim() === label)
    const box = row && row.querySelector('.el-checkbox')
    if (box) { box.click(); out.push(label) }
  }
  return out
})
await page.waitForTimeout(300)

// ② 「打印次数」▲ 两次(下移→前移两位;验证列顺序可调)
const moved = await page.evaluate(() => {
  const rows = () => [...document.querySelectorAll('.csd-item')]
  const find = (label) => rows().find((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim() === label)
  const before = rows().map((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim())
  for (let i = 0; i < 2; i++) {
    const btn = find('打印次数') && [...find('打印次数').querySelectorAll('button')].find((b) => (b.textContent || '').includes('▲'))
    if (btn) btn.click()
  }
  const after = rows().map((el) => ((el.querySelector('.csd-label') || {}).textContent || '').trim())
  return { before: before.slice(-4), after: after.slice(-4), order: after.indexOf('打印次数'), 总条数: after.length }
})
console.log('取消勾选:', JSON.stringify(unchecked), '上移:', JSON.stringify(moved))

// ③ 保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.csd-dialog .el-dialog__footer button')]
    .find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(1500)

const afterSave = await headers()
console.log('保存后表头:', JSON.stringify({ 批号: afterSave.includes('批号'), 备注: afterSave.includes('备注'), 打印次数位置: afterSave.indexOf('打印次数'), 打印时间位置: afterSave.indexOf('打印时间'), 列数: afterSave.length }))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-03-after-save.png' })

// ④ 刷新页面 → 重新选线 → 看是否仍按保存的显隐/顺序渲染
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => !el.classList.contains('off')) || lines[0]
  if (hit) hit.click()
})
await page.waitForTimeout(3500)
const afterReload = await headers()
console.log('刷新后表头:', JSON.stringify({ 批号: afterReload.includes('批号'), 备注: afterReload.includes('备注'), 打印次数位置: afterReload.indexOf('打印次数'), 打印时间位置: afterReload.indexOf('打印时间'), 列数: afterReload.length }))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-03-after-reload.png' })
