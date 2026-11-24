// round-04:按供应商「双喜」收窄 → 勾两张同供应商的单 → 加入合单 → 看合单页面
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const clear = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return { ok: false, why: 'no dialog' }
  // 取消已勾的行:点已勾的那行再点一次
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  const checkedTr = trs.find((tr) => tr.querySelector('.el-checkbox__input.is-checked'))
  if (checkedTr) checkedTr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true, hadChecked: !!checkedTr }
})
log('CLEAR', JSON.stringify(clear))
await page.waitForTimeout(500)

const typed = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...d.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === '供应商')
  if (!box) return { ok: false }
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, '双喜')
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(2500)

const rows = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
})
log('ROWS(' + rows.length + ')', JSON.stringify(rows.slice(0, 6)), 'typed=' + JSON.stringify(typed))

// 勾前两行(同一供应商)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  for (const tr of trs.slice(0, 2)) tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(700)

const picked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return {
    picked: (d.querySelector('.mpd-picked')?.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: d.querySelectorAll('.el-table__body .el-checkbox__input.is-checked').length,
    chips: [...d.querySelectorAll('.mpd-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
log('PICKED', JSON.stringify(picked))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-04-picked2.png' })

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(6000)

const merge = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  return boxes.map((d) => ({
    title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    bar: (d.querySelector('.gl-bar')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    docHeads: [...d.querySelectorAll('.gl-doc-head')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    rowsPerDoc: [...d.querySelectorAll('.gl-doc')].map((x) => x.querySelectorAll('.el-table__body tbody tr').length),
    lastHeaders: [...(d.querySelectorAll('.gl-doc')[0]?.querySelectorAll('.el-table__header th') || [])].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
    btns: [...d.querySelectorAll('.gl-bar button, .el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }))
})
log('MERGE', JSON.stringify(merge, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-04-merge.png' })
log('done round-04')
