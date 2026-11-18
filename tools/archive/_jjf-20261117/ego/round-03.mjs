const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
const docNo = process.env.JJF_NO || 'JJF-2026-11-0005'
await page.goto(`http://localhost:5173/#/panelx/list/QC_JJF?docNo=${docNo}`, { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 纸面滚动容器滚到底(签核线在纸面底部)
const scrolled = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.approval-sheet, .as-body, .ds-doc-wrap, .approval-layout')]
  let done = []
  for (const el of cands) {
    if (el.scrollHeight > el.clientHeight + 4) { el.scrollTop = el.scrollHeight; done.push(el.className + ':' + el.scrollTop) }
  }
  return done
})
console.log('scrolled:', JSON.stringify(scrolled))
await page.waitForTimeout(800)
const foot = await page.evaluate(() => {
  const root = document.querySelector('.approval-sheet') || document
  const all = [...root.querySelectorAll('div,tr')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    hasBianzhi: all.filter((t) => t.startsWith('编制')),
    hasShenhe: all.filter((t) => t.startsWith('审核')),
    hasPizhun: all.filter((t) => t.startsWith('批准')),
  }
})
console.log('footer:', JSON.stringify(foot, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r03-foot.png' })
console.log('done')
