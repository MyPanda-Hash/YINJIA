const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
const no = process.env.DOC_NO || 'JJF-2026-11-0005'
await page.goto(`http://localhost:5173/#/panelx/list/QC_JJF?docNo=${no}`, { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) {}
await page.waitForTimeout(800)
const info = await page.evaluate(() => {
  const out = []
  const all = [...document.querySelectorAll('div, main, section')]
  for (const el of all) {
    if (el.scrollHeight - el.clientHeight > 40 && el.clientHeight > 200) {
      out.push({ cls: (el.className || '').toString().slice(0, 40), sh: el.scrollHeight, ch: el.clientHeight })
      el.scrollTop = el.scrollHeight
    }
  }
  // 纸面底部落款 + 全文(确认没有「检测结果」)
  const sheet = document.querySelector('.approval-sheet') || document.body
  return {
    scrollers: out.slice(0, 6),
    footText: [...sheet.querySelectorAll('div')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /^(编制|审核|批准)：/.test(t)).slice(0, 4),
    hasTestResultRow: (sheet.textContent || '').includes('检测结果'),
    rowOrder: [...sheet.querySelectorAll('.q-section-title, .q-dept-name, .q-label')].map((e) => (e.textContent || '').trim()).slice(0, 14),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.waitForTimeout(600)
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r07-bottom.png' })
console.log('done')
