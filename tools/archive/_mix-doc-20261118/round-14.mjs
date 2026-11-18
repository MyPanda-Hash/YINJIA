/**
 * round-14:手机竖屏下看**已确认行**的样子(「撤回本项」按钮会不会压住 应投/实投 数字)。
 * 最后撤回这一笔,不给现场留脏草稿。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(400)

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.fill('input[placeholder*="扫物料码"]', 'YJ-TJHZ-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
await page.fill('.mp-qty input', '86.172')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(2000)

const layout = await page.evaluate(() => {
  const row = document.querySelector('.mp-line')
  const undo = document.querySelector('.mp-line-undo')
  const qty = row ? row.querySelector('.mp-line-qty') : null
  const rect = (el) => (el ? el.getBoundingClientRect().toJSON() : null)
  return {
    rowText: row ? row.innerText.replace(/\s+/g, ' ').trim() : '',
    undoRect: rect(undo),
    qtyRect: rect(qty),
    // 重叠判定:按钮的底边是否压住数量区(说明版面打架)
    overlaps: !!(undo && qty && undo.getBoundingClientRect().bottom > qty.getBoundingClientRect().top + 4),
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
console.log('== 已确认行(390 宽) ==')
console.log(JSON.stringify(layout, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-14-mobile-confirmed.png', fullPage: true })

// 撤回(清理验证数据)
const undoClicked = await page.evaluate(() => {
  const b = document.querySelector('.mp-line-undo')
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(1800)
const after = await page.evaluate(() => ({
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('混料进度')) || '',
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  submitDisabled: (() => { const b = document.querySelector('.mp-foot button'); return b ? !!b.disabled : null })(),
}))
console.log('== 撤回后 ==')
console.log(JSON.stringify({ undoClicked, ...after }, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
