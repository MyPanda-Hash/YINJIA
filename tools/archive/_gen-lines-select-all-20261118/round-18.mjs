import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 勾 YJ-20261012-07(本页唯一已审核,3 行)
const picked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')]
    .find((x) => (x.textContent || '').includes('YJ-20261012-07'))
  tr?.querySelector('.dsr-check .el-checkbox')?.click()
  return !!tr
})
console.log('rail picked:', picked)
await page.waitForTimeout(700)

await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').includes('批量生单'))?.click()
})
await page.waitForTimeout(4500)

const read = () => page.evaluate(() => {
  const headers = [...document.querySelectorAll('.gl-doc .el-table__header-wrapper th')]
  const h0 = headers[0]
  const input = h0?.querySelector('.el-checkbox__input')
  return {
    open: !!document.querySelector('.gl-dialog'),
    title: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
    topBarHasPickAll: !!document.querySelector('.gl-pick-all'),
    headerCellText: (h0?.textContent || '').trim(),
    headerHasBox: !!h0?.querySelector('.el-checkbox'),
    headerTitle: h0?.querySelector('.el-checkbox')?.getAttribute('title'),
    headerMixed: !!input?.className.includes('is-indeterminate'),
    headerChecked: !!input?.className.includes('is-checked'),
    headerDisabled: !!input?.className.includes('is-disabled'),
    rows: document.querySelectorAll('.gl-doc .el-table__body tr').length,
    perDoc: [...document.querySelectorAll('.gl-doc-pick .gl-picked')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})

console.log('OPEN', JSON.stringify(await read(), null, 2))

// 表头全选 → 本单 3 行全勾
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__header-wrapper th .el-checkbox')?.click() })
await page.waitForTimeout(700)
console.log('HEADER-PICK-ALL', JSON.stringify(await read()))

// 取消其中一行 → 表头变三态中间态
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__body tr .el-checkbox')?.click() })
await page.waitForTimeout(700)
console.log('PARTIAL', JSON.stringify(await read()))

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(300)
await page.screenshot({ path: DIR + '/round-18-header-partial.png' })

// 表头再点一次 → 清空本单
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__header-wrapper th .el-checkbox')?.click() })
await page.waitForTimeout(600)
console.log('HEADER-CLEAR', JSON.stringify(await read()))

// 截一张「表头全选已勾满」的特写
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__header-wrapper th .el-checkbox')?.click() })
await page.waitForTimeout(600)
const box = await page.evaluate(() => {
  const el = document.querySelector('.gl-doc .el-table__header-wrapper')
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x) - 4, y: Math.round(r.y) - 4, width: Math.min(560, Math.round(r.width)), height: Math.round(r.height) + 8 }
})
await page.screenshot({ path: DIR + '/round-18-header-clip.png', clip: box })
console.log('clip', JSON.stringify(box))
