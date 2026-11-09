// round-08:选中 7 行订单 YJ-20261012-11 → 打开打印弹窗 → 截屏(原始 CDP 兜底)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// 左栏点第 11 张单
await page.click('css=tbody tr:has-text("YJ-20261012-11")', { label: 'select 7-line purchase order' })
await page.waitForTimeout(2500)
console.log('selected=' + (await page.evaluate(() => {
  const t = [...document.querySelectorAll('tbody tr')].find((r) => (r.textContent || '').includes('YJ-20261012-11'))
  return t ? (t.className || '') + ' | ' + (t.textContent || '').replace(/\s+/g, ' ').trim() : 'not selected'
})))

await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open print dialog' })
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false }
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    rowCount: rows.length,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    rows: rows.map(txt),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log(JSON.stringify(dlg, null, 2))

// 截图:先试常规 API,失败再走原始 CDP + fromSurface=false
let shot = ''
try {
  shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-08-dialog.png' })
  console.log('screenshot ok=' + shot)
} catch (e) {
  console.log('page.screenshot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-08-dialog.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw cdp screenshot ok=' + p)
  } catch (e2) { console.log('raw cdp fail: ' + e2.message) }
}
