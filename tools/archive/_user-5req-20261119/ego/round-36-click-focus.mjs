const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim() === '3号车间')
  if (el) el.click()
})
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const wrap = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
  const el = [...document.querySelectorAll('.dp-plan')].find((e) => e.textContent.trim().includes('/'))
  if (!wrap || !el) return null
  const lefts = [...document.querySelectorAll('.el-table-fixed-column--left')]
  const rights = [...document.querySelectorAll('.el-table-fixed-column--right')]
  const lr = Math.max(...lefts.map((e) => e.getBoundingClientRect().right), 0)
  const rr = Math.min(...rights.map((e) => e.getBoundingClientRect().left), window.innerWidth)
  const r0 = el.getBoundingClientRect()
  const target = (lr + rr) / 2
  wrap.scrollLeft = Math.max(0, wrap.scrollLeft + (r0.x - target))
  const r = el.getBoundingClientRect()
  return { innerWidth: window.innerWidth, lr: Math.round(lr), rr: Math.round(rr), x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent.trim() }
})
console.log('POS', JSON.stringify(info))
if (info) {
  const el = await page.evaluate(({ x, y }) => {
    const e = document.elementFromPoint(x, y)
    return { tag: e?.tagName, cls: String(e?.className).slice(0, 60), txt: (e?.textContent || '').trim().slice(0, 15) }
  }, info)
  console.log('HIT', JSON.stringify(el))
  await page.mouse.click(info.x, info.y, { label: 'click date qty cell' })
  await page.waitForTimeout(600)
  console.log('AFTER', JSON.stringify(await page.evaluate(() => {
    const inp = document.querySelector('.dp-input input')
    return { hasInput: !!inp, focused: !!inp && document.activeElement === inp, value: inp?.value }
  })))
  await page.keyboard.type('88')
  await page.waitForTimeout(300)
  console.log('TYPE', JSON.stringify(await page.evaluate(() => ({ value: document.querySelector('.dp-input input')?.value }))))
  await page.keyboard.press('Escape')
}
