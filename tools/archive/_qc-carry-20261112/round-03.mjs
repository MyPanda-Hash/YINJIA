/* round-03.mjs — 3 张单各点一次「带入检验要求」→ 读行 → 保存为草稿 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')
const DOCS = ['JYSJ-2026-11-0010', 'JYSJ-2026-11-0011', 'JYSJ-2026-11-0012']

const readRows = () => page.evaluate(() => {
  const tbl = [...document.querySelectorAll('table.qr-table')]
    .find((t) => (t.querySelector('thead') || {}).innerText && /检验项/.test(t.querySelector('thead').innerText))
  if (!tbl) return { rows: [], note: 'no-detail-table' }
  const rows = [...tbl.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  const head = [...document.querySelectorAll('.qr-table')][0]
  const headText = head ? (head.innerText || '').replace(/\s+/g, ' ') : ''
  return { rows, headText: headText.slice(0, 260) }
})

const out = []
for (const no of DOCS) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 60000 })
  await page.waitForTimeout(6500)
  const before = await readRows()
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('.qr-carry-btn')
    if (!b) return 'no-btn'
    b.click()
    return 'clicked'
  })
  await page.waitForTimeout(4000)
  const after = await readRows()
  // 保存为草稿(右侧竖排按钮)
  const saved = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.as-btn, button, .el-button, span')]
    const b = all.find((x) => (x.textContent || '').trim() === '保存为草稿')
    if (!b) return 'no-save-btn'
    b.click()
    return 'saved-click'
  })
  await page.waitForTimeout(4000)
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()))
  out.push({ no, beforeRows: before.rows.length, headText: after.headText, clicked, rows: after.rows, saved, toasts })
  console.log('=== ' + no + ' -> ' + JSON.stringify(out[out.length - 1], null, 2))
}
console.log('SUMMARY=' + JSON.stringify(out.map((o) => ({ no: o.no, before: o.beforeRows, after: o.rows.length, toasts: o.toasts }))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { }
try { await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-carry-20261112/round-03.png' }) } catch (e) { console.log('shot fail ' + e.message) }
