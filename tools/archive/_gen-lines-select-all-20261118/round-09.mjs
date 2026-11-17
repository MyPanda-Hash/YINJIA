import fsp from 'node:fs/promises'
const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

// 1) 左栏本页全选
await page.click('.dsr-grid thead th.dsr-check .el-checkbox', { label: '左栏全选本页' })
await page.waitForTimeout(700)

// 2) 生单 ▼ → 合单生单
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.textContent || '').trim().startsWith('生单'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').includes('合单生单'))
  it?.click()
})
await page.waitForTimeout(4000)

const out = await page.evaluate(() => {
  const dlg = document.querySelector('.gl-dialog') || document.querySelector('.el-dialog')
  const bar = document.querySelector('.gl-bar')
  return {
    dlgOpen: !!dlg,
    title: (document.querySelector('.el-dialog__title')?.textContent || '').trim(),
    barText: (bar?.textContent || '').replace(/\s+/g, ' ').trim(),
    barHtml: (bar?.outerHTML || '').slice(0, 1400),
    pickAll: !!document.querySelector('.gl-pick-all'),
    checkedBoxes: document.querySelectorAll('.gl-pick-all input[type=checkbox]').length,
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
await page.screenshot({ path: DIR + '/round-09-merge-dialog.png' })
