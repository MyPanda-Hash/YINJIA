// round-21: 悬停/点击「审批」→ 找到并点「提交审批」→ 抓必填拦截提示(正式库草稿)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)

// 打开草稿行(首行)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  if (rows.length) (rows[0].querySelector('td') || rows[0]).click()
})
await page.waitForTimeout(5000)
console.log('当前单 =', await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value).find((v) => String(v).startsWith('IJ-'))))

const box = await page.evaluate(() => {
  const e = [...document.querySelectorAll('.tb-main')].find((x) => (x.textContent || '').trim() === '审批')
  if (!e) return null
  const r = e.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('审批按钮位置 =', JSON.stringify(box))
await page.mouse.move(box.x, box.y)
await page.waitForTimeout(1200)
const hovered = await page.evaluate(() => [...document.querySelectorAll('*')]
  .filter((e) => e.offsetParent !== null && /提交审批/.test((e.textContent || '')) && e.children.length === 0)
  .map((e) => ({ tag: e.tagName, cls: e.className, txt: (e.textContent || '').trim() })))
console.log('悬停后可见项 =', JSON.stringify(hovered))
await page.mouse.click(box.x, box.y)
await page.waitForTimeout(1200)
const afterClick = await page.evaluate(() => [...document.querySelectorAll('*')]
  .filter((e) => e.offsetParent !== null && /提交审批/.test((e.textContent || '')) && e.children.length === 0)
  .map((e) => ({ tag: e.tagName, cls: e.className, txt: (e.textContent || '').trim() })))
console.log('点击后可见项 =', JSON.stringify(afterClick))

const clicked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('*')]
    .find((e) => e.offsetParent !== null && (e.textContent || '').trim() === '提交审批' && e.children.length <= 1)
  if (!it) return false
  it.click()
  return it.className
})
console.log('点提交审批 =', clicked)
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => /确定|提交|确认/.test((x.textContent || '')))
  if (b) b.click()
})
await page.waitForTimeout(3000)
const res = await page.evaluate(() => ({
  messages: [...document.querySelectorAll('.el-message, .el-message-box__message, .el-notification__content')]
    .map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
}))
console.log('结果 =', JSON.stringify(res, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-21-submit-blocked.png' })
console.log('done round-21')
