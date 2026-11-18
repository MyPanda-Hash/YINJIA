const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.evaluate(() => { try { sessionStorage.removeItem('mes_fresh_draft') } catch (e) {} })
// 加查询参数强制整页重载(hash 变化不会触发 reload)
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 把明细表格横向滚到最右,让「工序序列」这一列进视野
console.log('scroll:', JSON.stringify(await page.evaluate(() => {
  const wrap = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || document.querySelector('.el-table__body-wrapper')
  if (!wrap) return null
  wrap.scrollLeft = wrap.scrollWidth
  return { scrollLeft: wrap.scrollLeft, scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth }
})))
await page.waitForTimeout(800)
console.log('rowNow:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()).slice(-6)))))

await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
  if (s) s.click()
})
// 闪烁动画 ≈2.2s:弹窗渲染后立刻截图,才能抓到格子闪
await page.waitForTimeout(700)
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-22-cell-blink.png' })
console.log('classes:', JSON.stringify(await page.evaluate(() => ({
  cellBlinkCells: [...document.querySelectorAll('.cell-blink')].map((td) => ({
    text: (td.innerText || '').trim(),
    bg: getComputedStyle(td).backgroundColor,
    shadow: getComputedStyle(td).boxShadow,
  })),
  rowMissing: document.querySelectorAll('.el-table__row.row-missing-hint').length,
  dialog: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
})), null, 2))
