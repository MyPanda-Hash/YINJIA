import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 重新造出「部分勾选」状态:先顶部全选,再取消第一行
await page.evaluate(() => { document.querySelector('.gl-pick-all .el-checkbox')?.click() })
await page.waitForTimeout(500)
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__body tr .el-checkbox')?.click() })
await page.waitForTimeout(600)

const dump = await page.evaluate(() => {
  const root = document.querySelector('.gl-pick-all')
  const label = root?.querySelector('.el-checkbox')
  const input = root?.querySelector('.el-checkbox__input')
  const inner = root?.querySelector('.el-checkbox__inner')
  return {
    labelCls: label?.className,
    inputCls: input?.className,
    innerCls: inner?.className,
    html: (root?.outerHTML || '').slice(0, 700),
    bar: (root?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log(JSON.stringify(dump, null, 2))

// 单独截这个控件,看它到底是什么形态
const box = await page.evaluate(() => {
  const el = document.querySelector('.gl-pick-all')
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x) - 6, y: Math.round(r.y) - 6, width: Math.round(r.width) + 12, height: Math.round(r.height) + 12 }
})
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(300)
await page.screenshot({ path: DIR + '/round-13-pickall-clip.png', clip: box })
console.log('clip', JSON.stringify(box))
