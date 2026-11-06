const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(4000)
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0036', { timeout: 45000 })
await page.waitForTimeout(11000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  docNoShown: (() => { const el = document.querySelector('.as-docno, .doc-no, [class*="docno"]'); return el ? (el.innerText || '').trim() : null })(),
  areas: document.querySelectorAll('textarea').length,
  itemRows: document.querySelectorAll('.qr-table tbody tr').length,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log(JSON.stringify(info, null, 2))
