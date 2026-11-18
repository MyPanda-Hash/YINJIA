const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 有「未保存提示」弹窗先处理掉(继续/确定),不影响下面要测的必填高亮
const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  if (!box) return null
  const btns = [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
  return { title: (box.querySelector('.el-message-box__title')?.textContent || '').trim(), btns }
})
console.log('unexpectedDialog:', JSON.stringify(dlg))
if (dlg) {
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
    const btns = [...box.querySelectorAll('button')]
    const b = btns.find((x) => /确定|继续|是/.test(x.textContent || '')) || btns[btns.length - 1]
    if (b) b.click()
  })
  await page.waitForTimeout(1500)
}

const doc = await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
}))
console.log('doc:', JSON.stringify(doc))

// 点「保存」:新草稿的 工艺路线名称/生效日期/失效日期 都是空的 ⇒ 必填校验必然拦下(不会写库)
const clicked = await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
  if (s) { s.click(); return true } return false
})
console.log('saveClicked:', clicked)
await page.waitForTimeout(2500)

console.log(JSON.stringify(await page.evaluate(() => ({
  dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
  dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
  headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
  cellBlink: document.querySelectorAll('.cell-blink').length,
  rowMissing: document.querySelectorAll('.el-table__row.row-missing-hint').length,
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-10-popup.png' })
