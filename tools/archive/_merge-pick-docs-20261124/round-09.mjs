// round-09:复验「补回来的行要自动勾上」(与首次打开同口径)—— 整条流程再走一遍:选2张 → 删1行 → 再选同一张 → 行回来且已勾
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const snap = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  if (!d) return { ok: false }
  return {
    ok: true,
    docs: [...d.querySelectorAll('.gl-doc')].map((x) => ({ no: (x.querySelector('.gl-doc-no')?.textContent || '').trim(), rows: x.querySelectorAll('.el-table__body tbody tr').length })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(5500)

// 生单 ▼ → 合单生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (g && !document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)

// 供应商 = 双喜 → 勾前两张 → 加入合单
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
log('M0', JSON.stringify(await snap()))

// 删掉第一张单的第 1 行
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const tr = d.querySelector('.gl-doc .el-table__body tbody tr')
  const tds = [...tr.querySelectorAll('td')]
  ;[...tds[tds.length - 1].querySelectorAll('button')].find((b) => (b.textContent || '').includes('删除行'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
log('AFTER_DEL', JSON.stringify(await snap()))
const firstDocNo = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  return (d.querySelector('.gl-doc-no')?.textContent || '').trim()
})

// 再选同一张单 → 应补回 1 行**并且自动勾上**(已选行数回到原值)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.gl-bar button')].find((b) => (b.textContent || '').trim() === '选择单据')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4000)
await page.evaluate((no) => {
  document.querySelectorAll('.el-message').forEach((m) => m.remove())
  const box = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  const tr = [...box.querySelectorAll('.el-table__body tbody tr')].find((r) => (r.querySelectorAll('td')[2]?.textContent || '').trim() === no)
  tr?.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}, firstDocNo)
await page.waitForTimeout(600)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1500)
const toast = await page.evaluate(() => [...new Set([...document.querySelectorAll('.el-message__content')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()))])
log('RESTORED', JSON.stringify(await snap()), JSON.stringify(toast))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-09-restored.png' })

// 收尾:取消(不生成)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
log('CLOSED', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim()))))
log('done round-09')
