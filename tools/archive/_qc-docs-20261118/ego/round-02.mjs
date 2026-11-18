const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1') // 复用 round-01 的登录态(测试库 admin)

async function wide() {
  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
    await page.waitForTimeout(400)
  } catch (e) { console.log('emulation skip: ' + e.message) }
}

await wide()
const no = process.env.DOC_NO || 'BHZ-2026-11-0003'
await page.goto(`http://localhost:5173/#/panelx/list/QC_BHZ?docNo=${no}`, { timeout: 30000 })
await page.waitForTimeout(5000)
await wide()
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet') || document.body
  const rows = [...sheet.querySelectorAll('.as-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    sheetW: Math.round(sheet.getBoundingClientRect().width),
    info: [...document.querySelectorAll('.as-info-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: rows.slice(0, 5),
    signNames: [...sheet.querySelectorAll('.q-signline')].map((l) => (l.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
    attach: !!document.querySelector('.as-attach-inline'),
    upload: [...document.querySelectorAll('.fac-upload-btn')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('QC_BHZ wide:', JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r02-bhz-wide.png' })
console.log('done')
