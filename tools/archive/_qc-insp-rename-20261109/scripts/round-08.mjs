// round-08 — 宽窗口截图:检验方案弹窗「检查频率」列显示真实值(夹具:ZC-2026-10-0033.产品编码=C-23-11)
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

// 放大窗口(截图前恢复 normal)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1600, height: 900 } })
  }
  await page.waitForTimeout(500)
} catch (e) { console.log('window skip: ' + e.message) }

await page.reload({ timeout: 30000 })
await page.waitForTimeout(7000)

// 左栏选草稿单
const picked = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.dsr-grid tbody tr')].find((r) => (r.textContent || '').includes('ZC-2026-10-0033'))
  if (!row) return false
  row.click()
  return true
})
await page.waitForTimeout(3000)
console.log('picked=' + picked)

// 打开弹窗
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (el) el.click()
})
await page.waitForTimeout(3500)

// 把弹窗表格横向滚到最右,让「检查频率」列进可视区
const scrolled = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const wrap = d?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || d?.querySelector('.el-table__body-wrapper')
  if (wrap) wrap.scrollLeft = 99999
  const hwrap = d?.querySelector('.el-table__header-wrapper .el-scrollbar__wrap') || d?.querySelector('.el-table__header-wrapper')
  if (hwrap) hwrap.scrollLeft = 99999
  return { scrolled: !!wrap }
})
await page.waitForTimeout(800)
console.log('scroll=' + JSON.stringify(scrolled))

const facts = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const headers = [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt)
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
  return {
    headers,
    rowCount: rows.length,
    rowsSample: rows.slice(0, 3),
    freqCells: rows.slice(0, 8).map((r) => r[5]),
    freqNonEmpty: rows.map((r) => r[5]).filter(Boolean).length,
    headerHasForbidden: headers.some((h) => h.includes('不合格应对措施')),
    headerHasFreq: headers.some((h) => h.includes('检查频率')),
  }
})
console.log('FACTS ' + JSON.stringify(facts, null, 2))
await page.screenshot({ path: OUT + '/r8-plan-dialog-wide.png' })
console.log('DONE')
