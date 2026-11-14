// round-02: 正式库(YJ)只读 —— ① 截图工具栏(桌面窗口先恢复正常) ② 点「审核」看置灰提示
// ③ 打开「审批 ▼」确认下拉里不再有「审核」。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(800)
} catch (e) { console.log('restore skip: ' + e.message) }

if (!String(await page.url()).includes('/panelx/list/PU_ORDER')) {
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(4000)
}

const before = await page.evaluate(() => ({
  hash: location.hash,
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
}))
console.log('BEFORE ' + JSON.stringify(before))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-02-toolbar.png' })

// 点「审核」(当前单=已审核 ⇒ 应当只弹一条置灰原因,不弹确认框、不发请求)
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(1200)
const tip = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message__content')]
  .map((el) => (el.textContent || '').trim()).filter(Boolean))
console.log('置灰提示 ' + JSON.stringify(tip))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-02-disabled-tip.png' })

// 打开「审批 ▼」:下拉里必须没有「审核」,且不再出现第二个审核入口
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审批')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(600)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
  .map((el) => ({ text: (el.textContent || '').trim(), disabled: (el.className || '').includes('disabled') })))
console.log('审批下拉 ' + JSON.stringify(menu))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-02-approval-dropdown.png' })
console.log('space=' + task.spaceId)
