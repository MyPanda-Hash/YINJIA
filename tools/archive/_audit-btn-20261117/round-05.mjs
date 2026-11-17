// 鐐逛竴涓嬨€屽鏍搞€嶁€斺€?鍙埌纭寮圭獥灏卞彇娑?涓嶅姩鐪熸暟鎹?,楠岃瘉鎸夐挳纭疄鎺ュ湪瀹℃牳鍔ㄤ綔涓娿€?const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(12000)
const before = await page.evaluate(() => (document.querySelector('.doc-status')?.textContent || '').trim())
const clicked = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '瀹℃牳')
  if (!g) return false
  g.querySelector('.tb-main').click()
  return true
})
await page.waitForTimeout(1800)
const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? {
    title: (box.querySelector('.el-message-box__title')?.textContent || '').trim(),
    body: (box.querySelector('.el-message-box__message')?.textContent || '').trim().slice(0, 140),
    hasOpinionInput: Boolean(box.querySelector('textarea')),
    buttons: [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  } : null
})
console.log(JSON.stringify({ before, clicked, dlg }, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/audit-confirm-dialog.png' })
const cancelled = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  const btn = box && [...box.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '鍙栨秷')
  if (btn) { btn.click(); return true }
  return false
})
await page.waitForTimeout(1500)
const after = await page.evaluate(() => (document.querySelector('.doc-status')?.textContent || '').trim())
console.log(JSON.stringify({ cancelled, before, after }))

