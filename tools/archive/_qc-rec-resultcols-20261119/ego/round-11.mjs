// round-11:先看清楚当前页在哪个单、是不是可编辑
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0021', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  statusText: (document.querySelector('.as-doc-chip, .doc-chip, .as-doc-status')?.textContent || '').trim(),
  hasStepper: !!document.querySelector('.qr-colstep'),
  stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
  headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
  editableInputs: document.querySelectorAll('.qr-table tbody td.c-res input').length,
  sideBtns: [...document.querySelectorAll('.as-side-btn')].map((b) => (b.textContent || '').trim()),
  docPickers: [...document.querySelectorAll('.as-doc-item, .doc-pick-item')].slice(0, 3).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(st, null, 2))
