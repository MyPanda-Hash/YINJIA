import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 勾前两张已审核订单(同一供应商才合单)
const picked = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 2)
  const info = trs.map((tr) => [...tr.querySelectorAll('td')].slice(1).map((td) => (td.textContent || '').trim()))
  for (const tr of trs) {
    const cb = tr.querySelector('.dsr-check .el-checkbox')
    cb?.click()
  }
  return info
})
console.log(JSON.stringify(picked, null, 2))
await page.waitForTimeout(600)

const state = await page.evaluate(() => (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim())
console.log('rail:', state)

// 生单 ▼ → 合单生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').includes('合单生单'))
  it?.click()
})
await page.waitForTimeout(5000)

const out = await page.evaluate(() => {
  const bar = document.querySelector('.gl-bar')
  return {
    dlgOpen: !!document.querySelector('.gl-dialog'),
    msg: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
    title: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
    barText: (bar?.textContent || '').replace(/\s+/g, ' ').trim(),
    pickAll: !!document.querySelector('.gl-pick-all'),
    docs: [...document.querySelectorAll('.gl-doc-no')].map((e) => e.textContent.trim()),
    rows: document.querySelectorAll('.gl-doc .el-table__body tr').length,
    footer: (document.querySelector('.gl-foot')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log(JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: DIR + '/round-11-merge-dialog.png' })
