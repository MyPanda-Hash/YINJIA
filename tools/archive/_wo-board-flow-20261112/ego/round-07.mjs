// 2026-11-12 round-07：口径清理后验收（上道完工量=原值500；不再有“折成品”列）
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
try { await page.cdp('Network.enable', {}) } catch (e) {}
try { await page.cdp('Network.setCacheDisabled', { cacheDisabled: true }) } catch (e) {}
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (el) el.click()
})
await page.waitForTimeout(5000)

const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.wb-main .el-table__header th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')]
  const target = rows.find((tr) => (tr.textContent || '').includes('GD-2026-11-0012'))
  // 逐列抓：表头索引 → 该行单元格文本
  const cells = target ? [...target.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : []
  return {
    heads,
    hasFoldCol: heads.some((h) => h.includes('折成品')),
    pairs: heads.map((h, i) => h + '=' + (cells[i] || '')).filter((s) => /上道|可加工|待报|待流入|当前工序/.test(s)),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-07-clean.png' })
