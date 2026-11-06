const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0084', { timeout: 45000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  if (!d) return { found: false }
  return {
    sub: (d.querySelector('.req-view-sub')?.innerText || '').replace(/\s+/g, ' ').trim(),
    tabLabels: [...d.querySelectorAll('.rsp-page-tab')].map((n) => (n.innerText || '').trim()),
    titles: [...d.querySelectorAll('.qc-title')].map((n) => (n.innerText || '').trim()),
    heads: [...d.querySelectorAll('.rs-th')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    dataRow: [...d.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24))).pop(),
  }
})
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-14.png' })
