// round-01:打开检验报告(QC_INSP_REC),确认登录态 + 现状(检测结果列数 / 步进器是否出现)
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4000)

const st = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  sectionBar: [...document.querySelectorAll('.qr-section')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
  stepper: document.querySelector('.qr-colstep') ? (document.querySelector('.qr-colstep').textContent || '').replace(/\s+/g, ' ').trim() : null,
  rows: document.querySelectorAll('.qr-table tbody tr').length,
  addbar: [...document.querySelectorAll('.qr-add')].map((el) => (el.textContent || '').trim()),
  docNo: (() => {
    const el = [...document.querySelectorAll('*')].find((n) => /^JYSJ-\d{4}-\d{2}-\d{4}$/.test((n.textContent || '').trim()))
    return el ? el.textContent.trim() : null
  })(),
}))
console.log(JSON.stringify(st, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-01.png' })
