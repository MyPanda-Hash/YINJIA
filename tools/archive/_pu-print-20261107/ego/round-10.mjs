// round-10:实测「勾选 + 填数量」对纸面的影响(把 window.print 换成记录器,不弹打印对话框)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(300)

// 1) 打桩:window.print 只记录,不进打印预览(避免阻塞自动化)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})

// 2) 取消勾选第 2 行
await page.click('css=.pup .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'uncheck line 2' })
await page.waitForTimeout(400)

// 3) 第 1 行数量改成 1234
await page.fill('css=.pup .el-input-number input >> nth=0', '1234')
await page.keyboard.press('Tab')
await page.waitForTimeout(600)

const edited = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    row1: txt(rows[0]),
    row2: txt(rows[1]),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('edited=' + JSON.stringify(edited, null, 2))

// 4) 截图(原始 CDP,fromSurface=false 兼容最小化/遮挡)
try {
  const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
  const fs = await import('node:fs/promises')
  const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-10-edited.png'
  await fs.writeFile(p, Buffer.from(res.data, 'base64'))
  console.log('screenshot ok=' + p)
} catch (e) { console.log('screenshot fail: ' + e.message) }

// 5) 确定并打印 → 读打印层 HTML
await page.click('text=确定并打印', { label: 'confirm and print' })
await page.waitForTimeout(2000)

const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  if (!host) return { present: false, printCalls: window.__printCalls, dialogOpen: !!document.querySelector('.pup') }
  const rows = [...host.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => txt(td)))
  return {
    present: true,
    printCalls: window.__printCalls,
    dialogOpen: !!document.querySelector('.pup'),
    title: txt(host.querySelector('h1')),
    header: txt(host.querySelector('.info')),
    tableHeaders: [...host.querySelectorAll('thead th')].map(txt),
    rows,
    rowCount: rows.length,
    hasUncheckedItem: txt(host).includes('YJ-KBL-012'),
    hasQty1234: txt(host).includes('1234'),
    hasPrice: txt(host).includes('0.0773'),
  }
})
console.log('paper=' + JSON.stringify(paper, null, 2))

// 6) 打桩还原 + 摘打印层
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
