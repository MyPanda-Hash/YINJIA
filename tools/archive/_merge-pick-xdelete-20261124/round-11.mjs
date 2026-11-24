// round-11:合单页面删除改成「行首一个叉」—— 看叉在不在、点一下能不能删、删除本单是否已撤
const task = await taskSpace('merge-x-delete-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)

// 生单 ▼ → 合单生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (g && !document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(900)
const menu = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')
  item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return !!item
})
log('MENU_OK', menu)
await page.waitForTimeout(4000)

// 供应商「双喜」→ 勾前两张 → 加入合单
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

const look = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  if (!d) return { ok: false }
  const doc0 = d.querySelector('.gl-doc')
  return {
    ok: true,
    docHeads: [...d.querySelectorAll('.gl-doc-head')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    rowsPerDoc: [...d.querySelectorAll('.gl-doc')].map((x) => x.querySelectorAll('.el-table__body tbody tr').length),
    xPerDoc: [...d.querySelectorAll('.gl-doc')].map((x) => x.querySelectorAll('.gl-x').length),
    firstRowCells: [...(doc0.querySelectorAll('.el-table__body tbody tr')[0]?.querySelectorAll('td') || [])].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()),
    headers: [...doc0.querySelectorAll('.el-table__header th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
    hasDelDoc: /删除本单/.test(d.textContent || ''),
  }
})

log('BEFORE', JSON.stringify(await look(), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-x-delete-20261124/round-11-x-rows.png' })

// 点第一张单第一行的叉
const clicked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  const x = d.querySelector('.gl-doc .gl-x')
  if (!x) return { ok: false }
  x.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(1200)
log('CLICK_X', JSON.stringify(clicked), JSON.stringify(await look(), null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-x-delete-20261124/round-11-after-x.png' })

// 收尾:取消
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim().startsWith('合单生单'))
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '取消')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
log('CLOSED', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim()))))
await task.finish({ keep: [] })
log('done round-11')
