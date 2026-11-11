const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0006', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 24),
    rowCount: rows.length,
    stdIsTextarea: rows.map((tr) => !!tr.querySelector('td.c-std textarea')),
    stdHeights: rows.map((tr) => { const t = tr.querySelector('td.c-std textarea') || tr.querySelector('td.c-std'); return t ? Math.round(t.getBoundingClientRect().height) : 0 }),
    rowHeights: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-53-edit.png' })

// 悬停第 2 行检测标准,验证 tooltip(内容超 6 行被收起时看全文)
const box = await page.evaluate(() => {
  const tr = document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')[1]
  const td = tr ? tr.querySelector('td.c-std') : null
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('hoverAt=' + JSON.stringify(box))
if (box) {
  await page.mouse.move(box.x, box.y)
  await page.waitForTimeout(2000)
  const tip = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.el-popper')].find((x) => x.offsetParent !== null)
    return p ? (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null
  })
  console.log('tooltip=' + JSON.stringify(tip))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-53-edit-tooltip.png' })
}
