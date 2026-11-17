const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
const docs = [
  { no: process.env.DRAFT_NO || 'JJF-2026-11-0014', tag: 'draft' },
  { no: process.env.L2_NO || 'JJF-2026-11-0015', tag: 'pendingL2' },
]
for (const d of docs) {
  await page.goto(`http://localhost:5173/#/panelx/list/QC_JJF?docNo=${d.no}`, { timeout: 30000 })
  await page.waitForTimeout(4500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  const info = await page.evaluate(() => ({
    docNo: (document.querySelector('.ds-docno, .as-docno, .as-docno-input input') || {}).value || '',
    statusTag: [...document.querySelectorAll('.el-tag, .dt-tab.on, .as-status')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 3),
    sideBtns: [...document.querySelectorAll('.as-side-btn, .as-side-btns button, .as-side-btns .el-button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    footer: [...document.querySelectorAll('.approval-sheet div')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /^编制：/.test(t)).slice(0, 2),
    listFirst: [...document.querySelectorAll('.dt-body tr, .dt-table tbody tr')].slice(0, 2).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  console.log(d.tag, JSON.stringify(info, null, 2))
  await page.screenshot({ path: `C:/Users/vigna/ego/jjf-twolevel-20261117/r04-${d.tag}.png` })
}
console.log('done')
