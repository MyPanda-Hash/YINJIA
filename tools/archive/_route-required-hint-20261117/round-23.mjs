const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.evaluate(() => { try { sessionStorage.removeItem('mes_fresh_draft') } catch (e) {} })
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 新增一张空白草稿 → 保存:表头 3 个必填 + 「请至少添加一行明细」,按钮该闪
await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '新增')
  if (s) s.click()
})
await page.waitForTimeout(6000)
console.log('newDoc:', JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
}))))

await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
  if (s) s.click()
})
await page.waitForTimeout(800)
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-23-btn-blink.png' })
console.log('result:', JSON.stringify(await page.evaluate(() => ({
  dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
  dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
  headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
  btnBlink: [...document.querySelectorAll('.btn-blink')].map((el) => ({ text: (el.textContent || '').trim(), shadow: getComputedStyle(el).boxShadow })),
})), null, 2))
