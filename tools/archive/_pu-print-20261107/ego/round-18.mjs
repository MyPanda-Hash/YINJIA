// round-18:「按订单数量填充」复位校验(改数量/取消勾选后点它 → 数量回订单值 + 全选)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)

await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) row.click()
})
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForTimeout(2800)

// 改第 1 行数量 + 取消勾选第 3 行
const changed = await page.evaluate(() => {
  const root = document.querySelector('.pup')
  const inp = root.querySelectorAll('.el-input-number input')[0]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '999')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  const boxes = root.querySelectorAll('.el-table__body .el-checkbox')
  boxes[2]?.click()
  return 'changed'
})
console.log(changed)
await page.waitForTimeout(700)
const before = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    qty: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('before=' + JSON.stringify(before))

// 点「按订单数量填充」
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '按订单数量填充')
  if (btn) btn.click()
})
await page.waitForTimeout(800)
const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    qty: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('after=' + JSON.stringify(after))

try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-18-reset.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-18-reset.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
await page.keyboard.press('Escape')
