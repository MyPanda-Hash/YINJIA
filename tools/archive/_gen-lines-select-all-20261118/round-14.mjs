import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 关掉合单弹窗
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gl-dialog button')].find((x) => (x.textContent || '').trim() === '取消')
  b?.click()
})
await page.waitForTimeout(1200)
const closed = await page.evaluate(() => !!document.querySelector('.gl-dialog') && document.querySelector('.gl-dialog').offsetParent !== null)
console.log('dialog still open:', closed)

// 生单 ▼ → 批量生单(左栏那 2 张已审核订单还在勾选状态)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').includes('批量生单'))
  it?.click()
})
await page.waitForTimeout(4500)

const out = await page.evaluate(() => {
  const bar = document.querySelector('.gl-bar')
  const pickAll = document.querySelector('.gl-pick-all')
  return {
    open: !!document.querySelector('.gl-dialog'),
    title: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
    barText: (bar?.textContent || '').replace(/\s+/g, ' ').trim(),
    pickAllBar: (pickAll?.textContent || '').replace(/\s+/g, ' ').trim(),
    docs: [...document.querySelectorAll('.gl-doc-no')].map((e) => e.textContent.trim()),
  }
})
console.log(JSON.stringify(out, null, 2))

// 点顶部全选 → 看是否一次勾上两张单的所有行
await page.evaluate(() => { document.querySelector('.gl-pick-all .el-checkbox')?.click() })
await page.waitForTimeout(700)
const after = await page.evaluate(() => ({
  pickAllBar: (document.querySelector('.gl-pick-all')?.textContent || '').replace(/\s+/g, ' ').trim(),
  perDoc: [...document.querySelectorAll('.gl-doc-pick .gl-picked')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))
console.log('AFTER', JSON.stringify(after))

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: DIR + '/round-14-batch-dialog.png' })
