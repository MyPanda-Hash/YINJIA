const task = await taskSpace('purin-whcalc')
const page = task.page('p1')

// 第二行子行:选仓库 C仓
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const a = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  a[1].querySelectorAll('.el-select')[0]?.querySelector('.el-select__wrapper')?.click()
  await sleep(700)
  const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
  const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  items.find((i) => (i.textContent || '').trim() === 'C仓')?.click()
  await sleep(500)
})
// 第二行子行:选仓位(C仓下第一个)
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const a = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  a[1].querySelectorAll('.el-select')[1]?.querySelector('.el-select__wrapper')?.click()
  await sleep(800)
  const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
  const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const names = items.map((i) => (i.textContent || '').trim())
  items[0]?.click()
  await sleep(400)
  window.__binPicked = names[0] || ''
})
const picked = await page.evaluate(() => window.__binPicked || '')
console.log('BIN=' + picked)

// 确定
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  ;[...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')?.click()
})
await page.waitForTimeout(8000)
const out = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  return {
    msgs: [...document.querySelectorAll('.el-message')].filter(vis).map((m) => (m.textContent || '').trim()),
    rows: [...document.querySelectorAll('.el-table__body-wrapper tr.el-table__row')].filter(vis).length,
  }
})
console.log('AFTER=' + JSON.stringify(out))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whcalc/c2-after-split.png' })
