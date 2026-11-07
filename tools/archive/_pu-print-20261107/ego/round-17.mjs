// round-17:供应商采购打印面板(SUPPLIER_PU_ORDER)同一弹窗 + 空勾选校验 + 全选/清空按钮
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/scm/supplierPrint', { timeout: 40000 })
await page.waitForTimeout(6000)

const head = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    locale: localStorage.getItem('mes_locale'),
    title: document.title,
    rail: txt(document.querySelector('.doc-select-rail')).slice(0, 120),
    toolbar: [...document.querySelectorAll('.tb-group')].map(txt),
  }
})
console.log('route=' + JSON.stringify(head, null, 2))

const opened = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (!row) return 'row not found'
  row.click()
  return 'selected'
})
console.log(opened)
await page.waitForTimeout(2500)

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (!el) return 'no print btn'
  el.click()
  return 'clicked print'
})
console.log(clicked)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, tail: txt(document.body).slice(-200) }
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    rowCount: root.querySelectorAll('.el-table__body tbody tr').length,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('dialog=' + JSON.stringify(dlg, null, 2))

// 清空 → 已选 0;再点确定 → 应提示且弹窗不关
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '清空')
  if (btn) btn.click()
})
await page.waitForTimeout(600)
const afterClear = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return { checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length, foot: txt(root.querySelector('.pup-foot')) }
})
console.log('afterClear=' + JSON.stringify(afterClear))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定并打印'))
  if (btn) btn.click()
})
await page.waitForTimeout(800)
const warn = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const msg = [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean)
  return { message: msg, dialogOpen: !!document.querySelector('.pup'), checked: document.querySelectorAll('.pup .el-table__body .el-checkbox.is-checked').length }
})
console.log('warn=' + JSON.stringify(warn, null, 2))

// 全选 → 7/7
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '全选')
  if (btn) btn.click()
})
await page.waitForTimeout(700)
const afterAll = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return { checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length, foot: txt(root.querySelector('.pup-foot')) }
})
console.log('afterAll=' + JSON.stringify(afterAll))

try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-17-supplier.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-17-supplier.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
await page.keyboard.press('Escape')
