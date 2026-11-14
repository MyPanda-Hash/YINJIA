// round-04:查清查询区/工具栏 DOM,便于下一轮精确点击
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

const dom = await page.evaluate(() => {
  const bar = document.querySelector('.query-bar, .filter-bar, .search-bar, .toolbar, .el-form')
  const inputs = [...document.querySelectorAll('input')].map((i, idx) => ({
    idx, type: i.type, ph: i.placeholder, val: i.value, cls: i.className,
  })).slice(0, 20)
  const buttons = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30)
  return { hasQueryBar: !!bar, inputs, buttons }
})
console.log(JSON.stringify(dom, null, 1))
