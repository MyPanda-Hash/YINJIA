// round-16:8090 打包版复验日期控件宽度 + 表头排序不折行(本月 + 按委托单)
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3500)
}
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

console.log('RANGE', JSON.stringify(await page.evaluate(() => {
  const r = document.querySelector('.iss-range')
  return {
    w: Math.round(r.getBoundingClientRect().width),
    inputs: [...document.querySelectorAll('.iss-range input')].map((i) => ({ w: Math.round(i.getBoundingClientRect().width), sw: i.scrollWidth, cw: i.clientWidth, val: i.value })),
  }
})))

await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1200)
const head = await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  const wrap = pane?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
  if (wrap) wrap.scrollLeft = 420
  return [...(pane?.querySelectorAll('.el-table__header th') || [])].filter((th) => th.querySelector('.caret-wrapper')).map((th) => {
    const cell = th.querySelector('.cell')
    const caret = th.querySelector('.caret-wrapper')
    return {
      text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
      thW: Math.round(th.getBoundingClientRect().width),
      cellH: Math.round(cell.getBoundingClientRect().height),
      caretTop: Math.round(caret.getBoundingClientRect().top - cell.getBoundingClientRect().top),
    }
  })
})
console.log('HEADS', JSON.stringify(head))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/16-8090-fixed.png` })
await task.finish({ keep: [] })
