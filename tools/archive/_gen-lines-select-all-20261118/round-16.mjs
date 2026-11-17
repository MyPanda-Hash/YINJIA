import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 左栏再勾前两张(上次已清空勾选;搜索条件仍是 PO-2026-10)
await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 2)
  for (const tr of trs) tr.querySelector('.dsr-check .el-checkbox')?.click()
})
await page.waitForTimeout(700)
console.log('rail', await page.evaluate(() => (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim()))

await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').includes('合单生单'))?.click()
})
await page.waitForTimeout(4500)

const read = () => page.evaluate(() => ({
  bar: (document.querySelector('.gl-pick-all')?.textContent || '').replace(/\s+/g, ' ').trim(),
  mixed: document.querySelector('.gl-pick-all .el-checkbox__input')?.className.includes('is-indeterminate'),
  footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  qtys: [...document.querySelectorAll('.gl-doc .el-table__body .el-input-number input')].map((i) => i.value),
}))

// 先把本次数量手工填一个 0.5,再试「取消全选」不会把它清掉
await page.evaluate(() => {
  const inp = document.querySelector('.gl-doc .el-table__body .el-input-number input')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '0.5')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await page.waitForTimeout(500)

await page.evaluate(() => { document.querySelector('.gl-pick-all .el-checkbox')?.click() })
await page.waitForTimeout(600)
console.log('PICK-ALL', JSON.stringify(await read()))

await page.evaluate(() => {
  [...document.querySelectorAll('.gl-pick-all button')].find((x) => (x.textContent || '').includes('取消全选'))?.click()
})
await page.waitForTimeout(700)
console.log('UNPICK-ALL', JSON.stringify(await read()))

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(300)
await page.screenshot({ path: DIR + '/round-16-unpick-keeps-qty.png' })

// 收尾:关弹窗 + 清勾选
await page.evaluate(() => {
  [...document.querySelectorAll('.gl-dialog button')].find((x) => (x.textContent || '').trim() === '取消')?.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  [...document.querySelectorAll('.dsr-picked button')].find((x) => (x.textContent || '').includes('清空'))?.click()
})
console.log('closed', JSON.stringify(await page.evaluate(() => (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim())))
