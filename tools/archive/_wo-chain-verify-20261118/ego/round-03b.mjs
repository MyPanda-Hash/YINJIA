// round-03b: 快速排产 → 全部 → 过滤 GD-2026-10-0228 + 切炭4(X) → 选中 → 预排线 → 读日期链
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
// 确保「全部」开关是开的
await page.evaluate(() => {
  const sw = document.querySelector('.sb-head .el-switch')
  if (sw && !sw.classList.contains('is-checked')) sw.click()
})
await page.waitForTimeout(2500)
await page.fill('input[placeholder*="加工单号 / 行号"]', 'GD-2026-10-0228 切炭4(X)')
await page.waitForTimeout(1500)
const before = await page.evaluate(() => ({
  blocks: [...document.querySelectorAll('.sb-block-title')].map((x) => x.textContent.trim()),
  rows: [...document.querySelectorAll('.sb-block .el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
}))
console.log('filtered: ' + JSON.stringify(before, null, 2))
await page.click('.sb-block .el-table__body tr')
await page.waitForTimeout(800)
await page.click('text="预排线"')
await page.waitForTimeout(3500)
const dialog = await page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  if (!d) return { open: false }
  const rows = [...d.querySelectorAll('.el-table__body tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    const inputs = [...tr.querySelectorAll('input')].map((i) => i.value)
    return { cells, inputs }
  })
  return { open: true, title: (d.querySelector('.el-dialog__title') || {}).textContent, rows }
})
console.log(JSON.stringify(dialog, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-03-chain.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
