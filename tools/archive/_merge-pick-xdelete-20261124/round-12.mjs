// round-12:确认最终样式(叉 20px / 常态 #98a5b0,悬停红底)—— 只看一眼,不删
const task = await taskSpace('merge-x-final-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (g && !document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...d.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === '供应商')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, '双喜')
  box.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.el-table__body tbody tr')].slice(0, 2).forEach((tr) => tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(7000)

const style = await page.evaluate(() => {
  const x = document.querySelector('.gl-x')
  if (!x) return { ok: false }
  const cs = getComputedStyle(x)
  return { ok: true, color: cs.color, fontSize: cs.fontSize, w: cs.width, h: cs.height, cursor: cs.cursor, count: document.querySelectorAll('.gl-x').length }
})
log('X_STYLE', JSON.stringify(style))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
// 悬停第一颗叉,截个红底效果
await page.evaluate(() => {
  const x = document.querySelector('.gl-x')
  x?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  x?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
})
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-x-final-20261124/round-12-final.png' })

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1000)
log('CLOSED', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length)))
await task.finish({ keep: [] })
log('done round-12')
