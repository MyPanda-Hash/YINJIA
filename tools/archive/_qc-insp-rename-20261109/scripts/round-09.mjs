// round-09 — 用 Emulation.setDeviceMetricsOverride 放大视口,完整截出弹窗(检查频率列可见)
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1560, height: 900, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(800)
console.log('viewport=' + JSON.stringify(await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))))

await page.reload({ timeout: 30000 })
await page.waitForTimeout(7000)

// 左栏选草稿单(产品编码夹具=C-23-11)
const picked = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.dsr-grid tbody tr')].find((r) => (r.textContent || '').includes('ZC-2026-10-0033'))
  if (!row) return false
  row.click()
  return true
})
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (el) el.click()
})
await page.waitForTimeout(3500)

const facts = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const headers = [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt)
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
  return { headers, rowCount: rows.length, freqCells: rows.slice(0, 8).map((r) => r[5]), headerHasForbidden: headers.some((h) => h.includes('不合格应对措施')) }
})
console.log('FACTS ' + JSON.stringify(facts, null, 2))
await page.screenshot({ path: OUT + '/r9-plan-dialog-full.png' })
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
console.log('DONE picked=' + picked)
