// round-14:复验日期控件宽度 + 表头排序箭头与文字是否同一行
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)

const rangeInfo = await page.evaluate(() => {
  const r = document.querySelector('.iss-range')
  const inputs = [...document.querySelectorAll('.iss-range input')]
  return {
    w: Math.round(r.getBoundingClientRect().width),
    h: Math.round(r.getBoundingClientRect().height),
    inputs: inputs.map((i) => ({ w: Math.round(i.getBoundingClientRect().width), sw: i.scrollWidth, cw: i.clientWidth, val: i.value })),
  }
})
console.log('RANGE', JSON.stringify(rangeInfo))

const heads = async (paneIdx) => page.evaluate((idx) => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][idx]
  return [...(pane?.querySelectorAll('.el-table__header th') || [])].filter((th) => th.querySelector('.caret-wrapper')).map((th) => {
    const cell = th.querySelector('.cell')
    const caret = th.querySelector('.caret-wrapper')
    return {
      text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
      thW: Math.round(th.getBoundingClientRect().width),
      cellH: Math.round(cell.getBoundingClientRect().height),
      caretOffsetTop: Math.round(caret.getBoundingClientRect().top - cell.getBoundingClientRect().top),
    }
  })
}, paneIdx)

console.log('HEADS_SENDER', JSON.stringify(await heads(0)))
await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1200)
console.log('HEADS_DOC', JSON.stringify(await heads(1)))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/14-fixed-layout.png` })
await task.finish({ keep: [] })
