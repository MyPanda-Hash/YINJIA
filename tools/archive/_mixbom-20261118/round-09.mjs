const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/ASM_BOM?docNo=C-23-11_V0001', { timeout: 30000 })
await page.waitForTimeout(3000)
try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w?.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(300) } catch (e) {}
const opened = await page.evaluate(() => {
  const span = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '删除')
  const grp = span && span.parentElement
  const caret = grp && grp.querySelector('.tb-caret')
  if (!caret) return 'no-caret'
  caret.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'clicked'
})
await page.waitForTimeout(900)
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popper li, [class*="dropdown"] [class*="item"], .tb-menu-item')].map((e) => (e.textContent || '').trim()).filter(Boolean))
console.log('OPEN', opened, 'ITEMS', JSON.stringify(items))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/09-delete-doc.png' })
