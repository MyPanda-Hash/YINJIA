const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.evaluate(() => { try { sessionStorage.removeItem('mes_fresh_draft') } catch (e) {} })
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

console.log('beforeSave:', JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
}))))

await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
  if (s) s.click()
})
await page.waitForTimeout(2500)

console.log('afterSave:', JSON.stringify(await page.evaluate(() => ({
  dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
  dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
  headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
  cellBlinkTexts: [...document.querySelectorAll('.cell-blink')].map((td) => (td.innerText || '').trim()),
  rowMissing: [...document.querySelectorAll('.el-table__row.row-missing-hint')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-20-popup.png' })

// 关掉弹窗,截未遮挡的高亮现场
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  const btns = box ? [...box.querySelectorAll('button')] : []
  if (btns.length) btns[btns.length - 1].click()
})
await page.waitForTimeout(1200)
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-21-highlight.png' })
