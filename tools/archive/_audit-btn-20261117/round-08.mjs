// 点一下「审核」—— 只到确认弹窗就取消(不动真数据),验证按钮确实接在审核动作上。
const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(12000)
const before = await page.evaluate(() => (document.querySelector('.doc-status')?.textContent || '').trim())
const clicked = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  if (!g) return false
  g.querySelector('.tb-main').click()
  return true
})
await page.waitForTimeout(2000)
const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? {
    title: (box.querySelector('.el-message-box__title')?.textContent || '').trim(),
    body: (box.querySelector('.el-message-box__message')?.textContent || '').trim().slice(0, 160),
    hasOpinionInput: Boolean(box.querySelector('textarea')),
    buttons: [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  } : null
})
console.log(JSON.stringify({ before, clicked, dlg }, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/audit-confirm-dialog.png' })
const cancelled = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  const buttons = box ? [...box.querySelectorAll('button')] : []
  const btn = buttons.find((b) => (b.textContent || '').trim() === '取消')
  if (btn) { btn.click(); return '取消' }
  const esc = buttons[0]
  if (esc) { esc.click(); return 'first' }
  return null
})
await page.waitForTimeout(1800)
const after = await page.evaluate(() => (document.querySelector('.doc-status')?.textContent || '').trim())
console.log(JSON.stringify({ cancelled, before, after }))
