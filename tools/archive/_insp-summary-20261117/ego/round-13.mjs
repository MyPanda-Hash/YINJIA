// round-13:量日期区间控件与表头排序格的真实尺寸/样式
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
const m = await page.evaluate(() => {
  const range = document.querySelector('.iss-range')
  const inner = range?.matches('.el-date-editor') ? range : range?.querySelector('.el-date-editor')
  const inputs = [...document.querySelectorAll('.iss-range input')]
  const box = (el) => el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, cls: el.className } : null
  // 表头排序格:检测项目数(在「按委托单/样品」页签里);两个页签都取一遍
  const pane1 = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][0]
  const heads1 = [...(pane1?.querySelectorAll('.el-table__header th') || [])].map((th) => ({
    text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
    w: th.getBoundingClientRect().width,
    cell: th.querySelector('.cell')?.getBoundingClientRect().height,
    cellDisplay: th.querySelector('.cell') ? getComputedStyle(th.querySelector('.cell')).display : '',
    caret: th.querySelector('.caret-wrapper')?.getBoundingClientRect().height || 0,
    sortable: !!th.querySelector('.caret-wrapper'),
  }))
  return {
    range: box(range),
    editor: box(inner),
    inputs: inputs.map((i) => ({ w: i.getBoundingClientRect().width, sw: i.scrollWidth, cw: i.clientWidth, val: i.value })),
    heads1,
  }
})
console.log(JSON.stringify(m, null, 2))
// 切到按委托单看表头
await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1200)
const h2 = await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  return [...(pane?.querySelectorAll('.el-table__header th') || [])].map((th) => ({
    text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
    w: th.getBoundingClientRect().width,
    sortable: !!th.querySelector('.caret-wrapper'),
    cellH: th.querySelector('.cell')?.getBoundingClientRect().height,
  }))
})
console.log('HEADS2', JSON.stringify(h2, null, 2))
await task.finish({ keep: [] })
