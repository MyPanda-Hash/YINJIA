import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const read = () => page.evaluate(() => {
  const th = document.querySelector('.gl-doc .el-table__header-wrapper th')
  const input = th?.querySelector('.el-checkbox__input')
  return {
    headerCls: input?.className,
    headerTitle: th?.querySelector('.el-checkbox')?.getAttribute('title'),
    headText: (document.querySelector('.gl-doc-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
    perDoc: [...document.querySelectorAll('.gl-doc-pick .gl-picked')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('OPEN(3行默认全勾)', JSON.stringify(await read()))

// 取消第 1 行 → 表头三态中间态
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__body tr .el-checkbox')?.click() })
await page.waitForTimeout(700)
console.log('PARTIAL', JSON.stringify(await read()))

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: DIR + '/round-20-dialog-partial.png' })

const box = await page.evaluate(() => {
  const d = document.querySelector('.gl-doc')
  const r = d.querySelector('.el-table__header-wrapper').getBoundingClientRect()
  return { x: Math.round(r.x) - 4, y: Math.round(r.y) - 10, width: 520, height: 62 }
})
await page.screenshot({ path: DIR + '/round-20-header-clip.png', clip: box })
console.log('clip', JSON.stringify(box))

// 表头再点一下 → 本单全勾
await page.evaluate(() => { document.querySelector('.gl-doc .el-table__header-wrapper th .el-checkbox')?.click() })
await page.waitForTimeout(700)
console.log('HEADER-ALL', JSON.stringify(await read()))

// 收尾
await page.evaluate(() => {
  [...document.querySelectorAll('.gl-dialog button')].find((x) => (x.textContent || '').trim() === '取消')?.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  [...document.querySelectorAll('.dsr-picked button')].find((x) => (x.textContent || '').includes('清空'))?.click()
})
console.log('closed', JSON.stringify(await page.evaluate(() => (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim())))
