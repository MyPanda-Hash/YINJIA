// round-30:打开测试库里已归档的一张(IP-2026-10-0011),点「单据预览」,看纸上最下层那格
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?docNo=IP-2026-10-0011', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log('loaded:', JSON.stringify(await page.evaluate(() => ({
  hasFooter: !!document.querySelector('.rsp-footer-field'),
  footerText: (document.querySelector('.rsp-footer-field') || {}).textContent,
  cols: document.querySelectorAll('table.rs-dt th').length,
}))))
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '单据预览')
  if (b) { b.click(); return true }
  return false
})
console.log('preview clicked:', clicked)
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
// 滚到预览最下面
await page.evaluate(() => {
  for (const e of [...document.querySelectorAll('*')]) {
    if (e.scrollHeight > e.clientHeight + 60 && e.clientHeight > 200) e.scrollTop = e.scrollHeight
  }
})
await page.waitForTimeout(1200)
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-30-preview-bottom.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title') || {}).textContent),
  hasFooterInPreview: [...document.querySelectorAll('.rsp-footer-field')].length,
  footerTexts: [...document.querySelectorAll('.rsp-footer-field')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').slice(0, 80)),
})), null, 2))
