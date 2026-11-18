const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.click('loc=css:.query-date-range', { label: '打开单据日期区间' })
await page.waitForTimeout(800)
await page.click('text=上月', { label: '选择上月区间' })
await page.waitForTimeout(2500)
const before = await page.evaluate(() => {
  const pc = document.querySelector('.portal-content')
  const rb = document.querySelector('.report-body')
  return {
    pc: pc ? { sh: pc.scrollHeight, ch: pc.clientHeight, st: pc.scrollTop } : null,
    rb: rb ? { h: rb.getBoundingClientRect().height, bottom: rb.getBoundingClientRect().bottom } : null,
    footerRect: (() => { const f = document.querySelector('.el-table__footer-wrapper'); if (!f) return null; const r = f.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height } })(),
    win: { ih: innerHeight, sy: scrollY },
  }
})
console.log('BEFORE', JSON.stringify(before))
await page.evaluate(() => {
  const pc = document.querySelector('.portal-content')
  if (pc) pc.scrollTop = pc.scrollHeight
  window.scrollTo(0, document.body.scrollHeight)
})
await page.waitForTimeout(1000)
const after = await page.evaluate(() => {
  const f = document.querySelector('.el-table__footer-wrapper')
  const r = f ? f.getBoundingClientRect() : null
  const cells = [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim())
  return { footerRect: r ? { top: r.top, bottom: r.bottom } : null, cells, ih: innerHeight }
})
console.log('AFTER', JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-21-footer.png' })
