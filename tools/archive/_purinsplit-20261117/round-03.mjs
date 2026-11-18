const task = await taskSpace('purin-manualqty')
const page = task.page('p1')

// 关掉当前弹窗,重开
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].filter(vis).find((b) => (b.textContent || '').trim() === '取消')
  btn?.click()
})
await page.waitForTimeout(1200)

await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  btn?.click()
})
await page.waitForTimeout(3500)

const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return { err: 'no-dialog' }
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  // 第 2 行(6200,没有拆过)
  carets[1].click(); await sleep(500); carets[1].click(); await sleep(600)
  const allocs = () => [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const setQty = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.blur()
  }
  let a = allocs()
  const rows = a.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24))
  // 先填两个仓库
  const pick = async (rowIdx, name) => {
    const tr = allocs()[rowIdx]
    tr.querySelector('.el-select .el-select__wrapper')?.click()
    await sleep(700)
    const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
    const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
    items.find((i) => (i.textContent || '').trim() === name)?.click()
    await sleep(300)
  }
  await pick(a.length - 2, '恒亿仓')
  await pick(a.length - 1, 'C仓')
  let cur = allocs()
  setQty(cur[cur.length - 2].querySelector('.el-input-number input'), '6000')
  await sleep(300)
  setQty(cur[cur.length - 1].querySelector('.el-input-number input'), '200')
  await sleep(400)
  const footEq = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  cur = allocs()
  setQty(cur[cur.length - 1].querySelector('.el-input-number input'), '500')
  await sleep(500)
  const footOver = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  return { allocRows: rows.length, footEq, footOver, okDisabledOver: ok?.disabled }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-manualqty/m2-over.png' })
