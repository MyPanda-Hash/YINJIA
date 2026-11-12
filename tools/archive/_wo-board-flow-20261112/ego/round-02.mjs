// 2026-11-12 按量流转·工单排产列表页 round-02：横向滚动到新列 + 展开逐道明细
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 查询
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('输入查询条件'))
  if (inp) setVal(inp, 'GD-2026-11-0012')
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('输入查询条件'))
  if (inp) inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
})
await page.waitForTimeout(4000)

// 展开首行（全宽后再截）
await page.evaluate(() => {
  const icon = document.querySelector('.el-table__expand-icon')
  if (icon) icon.click()
})
await page.waitForTimeout(1200)

// 把表格横向滚到最右，露出新增的 4 列
const scrolled = await page.evaluate(() => {
  const wrap = document.querySelector('.el-table__body-wrapper')
  if (!wrap) return 'no-wrapper'
  wrap.scrollLeft = wrap.scrollWidth
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  return { scrollWidth: wrap.scrollWidth, scrollLeft: wrap.scrollLeft, heads }
})
console.log(JSON.stringify(scrolled))
await page.waitForTimeout(800)
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-02-columns.png' })

// 再读一次展开明细（全宽渲染后）
const detail = await page.evaluate(() => {
  const box = document.querySelector('.wol-flow-box')
  if (!box) return { found: false }
  return {
    found: true,
    head: [...box.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim()),
    rows: [...box.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())),
  }
})
console.log('EXPAND: ' + JSON.stringify(detail))
