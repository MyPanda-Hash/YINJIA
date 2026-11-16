// 2026-11-12 round-08：确认工序列顺序（上道工序/上道完工量前移到日期列之前，未交量保持原位）
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
  const heads = [...document.querySelectorAll('.wb-main .el-table__header th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const iCur = heads.indexOf('当前工序')
  const iUp = heads.indexOf('上道工序')
  const iUpQty = heads.indexOf('上道完工量')
  const iOut = heads.indexOf('未交量')
  const iDate = heads.findIndex((h) => /^\d{2}-\d{2}/.test(h))
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')]
  const target = rows.find((tr) => (tr.textContent || '').includes('GD-2026-11-0012'))
  const cells = target ? [...target.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : []
  return {
    slice: heads.slice(Math.max(0, iCur - 2), iCur + 14),
    idx: { iCur, iUp, iUpQty, iOut, iDate },
    orderOk: iUp > iCur && iUpQty > iUp && iDate > iUpQty && iOut > iDate,
    sample: ['当前工序', '当前工序计划量', '当前工序完工量', '上道工序', '上道完工量', '可加工量', '待报量', '待流入量'].map((h) => {
      const i = heads.indexOf(h); return h + '=' + (cells[i] || '')
    }),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-08-order.png' })
