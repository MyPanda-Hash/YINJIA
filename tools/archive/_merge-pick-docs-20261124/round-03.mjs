// round-03:选单窗里按供应商收窄 → 点行勾两张 → 加入合单 → 看合单页面
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const dialogs0 = await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.textContent || '').trim()))
log('OPEN_DIALOGS', JSON.stringify(dialogs0))

// 1) 供应商片段
const typed = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === '供应商')
  if (!box) return { ok: false, ins: [...document.querySelectorAll('.mpd-bar input')].map((i) => i.placeholder) }
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, '惠州')
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, v: box.value }
})
log('SUPPLIER_INPUT', JSON.stringify(typed))
await page.waitForTimeout(300)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const btn = [...d.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(2500)

const rows = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
})
log('ROWS(' + rows.length + ')', JSON.stringify(rows.slice(0, 8)))

// 2) 点前两行(整行点击 = 勾选)
const pick = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const trs = [...d.querySelectorAll('.el-table__body tbody tr')]
  const out = []
  for (const tr of trs.slice(0, 2)) {
    const td = tr.querySelector('td:nth-child(3)')
    ;(td || tr).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    out.push((tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60))
  }
  return out
})
await page.waitForTimeout(600)
const pickedTxt = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return {
    picked: (d.querySelector('.mpd-picked')?.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: d.querySelectorAll('.el-table__body .el-checkbox__input.is-checked').length,
  }
})
log('PICKED', JSON.stringify(pick), JSON.stringify(pickedTxt))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-03-picked.png' })

// 3) 加入合单
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(5000)

const merge = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  return boxes.map((d) => ({
    title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    bar: (d.querySelector('.gl-bar')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    docHeads: [...d.querySelectorAll('.gl-doc-head')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    tables: [...d.querySelectorAll('.gl-doc')].map((x) => ({
      rows: x.querySelectorAll('.el-table__body tbody tr').length,
      headers: [...x.querySelectorAll('.el-table__header th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    })),
    foot: (d.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
    btns: [...d.querySelectorAll('.gl-bar button, .el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }))
})
log('MERGE', JSON.stringify(merge, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-03-merge.png' })
log('done round-03')
