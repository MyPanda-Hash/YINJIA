const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
console.log('sub=' + (await jwtSub()))
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0007', { timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) {}
console.log('before=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    material: txt(document.querySelectorAll('.qr-head-table .qr-value')[2]),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => txt(tr.querySelector('td.c-item'))),
  }
})))

// 点「带入检验要求」
console.log('carry=' + await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-carry-btn')][0]
  if (!el) return 'NO-BTN'
  el.click(); return 'CLICKED'
}))
const msgs = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
await page.waitForTimeout(1200)
console.log('after=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
      item: txt(tr.querySelector('td.c-item')),
      std: (txt(tr.querySelector('td.c-std')) || '').slice(0, 24),
    })),
  }
}), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-75-carry-parent.png' })
