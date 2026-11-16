// 2026-11-12 round-03：定位滚动容器 + 展开行（先探测结构，再操作）
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderList', { timeout: 40000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
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

// 探测 DOM
const dom = await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('.el-table__body-wrapper, .el-scrollbar__wrap, .el-table__inner-wrapper')]
  return {
    rows: document.querySelectorAll('.el-table__body tr.el-table__row').length,
    expandIcons: document.querySelectorAll('.el-table__expand-icon').length,
    wraps: wraps.map((w) => ({ cls: w.className, sw: w.scrollWidth, cw: w.clientWidth })),
    bodyText: (document.querySelector('.el-table__body') || {}).innerText || '',
  }
})
console.log('DOM: ' + JSON.stringify(dom).slice(0, 1200))

// 点展开（点里面那个箭头元素）
await page.evaluate(() => {
  const icon = document.querySelector('.el-table__expand-icon')
  if (icon) icon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)

// 横向滚到最右：对每个候选容器都滚一次
const scrolled = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.el-scrollbar__wrap, .el-table__body-wrapper')]
  const out = []
  for (const c of cands) {
    if (c.scrollWidth > c.clientWidth) { c.scrollLeft = c.scrollWidth; out.push({ cls: c.className, sw: c.scrollWidth, sl: c.scrollLeft }) }
  }
  return out
})
console.log('SCROLLED: ' + JSON.stringify(scrolled))
await page.waitForTimeout(800)
const detail = await page.evaluate(() => {
  const box = document.querySelector('.wol-flow-box')
  return box ? {
    head: [...box.querySelectorAll('thead th')].map((t) => (t.textContent || '').trim()),
    rows: [...box.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())),
  } : { found: false }
})
console.log('EXPAND: ' + JSON.stringify(detail))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-03-full.png' })
