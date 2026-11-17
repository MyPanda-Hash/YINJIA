const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 点工具栏「保存」(当前单据的工序序列为空 ⇒ 必填校验必然拦下,不会写库)
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => (x.textContent || '').replace(/\s+/g, '').trim() === '保存')
  if (b) { b.click(); return true }
  return false
})
console.log('saveClicked:', clicked)
await page.waitForTimeout(2000)

console.log(JSON.stringify(await page.evaluate(() => ({
  dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
  dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
  headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
  cellBlink: document.querySelectorAll('.cell-blink').length,
  rowMissing: [...document.querySelectorAll('.el-table__row.row-missing-hint')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 5).map((td) => (td.innerText || '').trim())),
})), null, 2))

await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-05-popup.png' })

// 关掉弹窗,单独截一张未遮挡的高亮现场
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box__btns button')].pop()
  if (b) b.click()
})
await page.waitForTimeout(1200)
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-06-highlight.png' })
