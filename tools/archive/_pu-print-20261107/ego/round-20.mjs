// round-20:供应商账号(kbl01)真实点击「打印」→ 可编辑弹窗 → 取消勾选/改数量 → 出纸核对;
//          再切「无金额」出纸核对。打印用打桩的 window.print 记录(不进打印机)。
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(500)

// 供应商会话在 #/scm/supplierPrint,单据 YJ-20261012-11(7 行,属于 YJ-KBL)
const session = await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return { hash: location.hash, userName: u.userName, supplierCode: u.supplierCode, top: txt(document.body).slice(0, 120) }
})
console.log('session=' + JSON.stringify(session, null, 2))

// 打桩 window.print(只记录,不开打印预览)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})

// ① 点工具栏「打印」(主按钮 = 打印采购订单)
await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open PO print dialog (supplier)' })
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1200)

const before = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    rowCount: root.querySelectorAll('.el-table__body tbody tr').length,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('before=' + JSON.stringify(before, null, 2))

// ② 真实点击:取消勾选第 2 行
await page.click('css=.pup .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'uncheck line 2 (supplier)' })
await page.waitForTimeout(400)

// ③ 真实输入:第 1 行数量改成 1234(点进输入框 → 全选 → 键入 → Tab 提交)
await page.click('css=.pup .el-input-number input >> nth=0', { label: 'focus print qty line 1' })
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.type('1234')
await page.keyboard.press('Tab')
await page.waitForTimeout(800)

const edited = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    qty: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    row1: txt(root.querySelectorAll('.el-table__body tbody tr')[0]),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('edited=' + JSON.stringify(edited, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-20-supplier-edited.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }

// ④ 真实点击「确定并打印」
await page.click('text=确定并打印', { label: 'confirm print (supplier)' })
await page.waitForTimeout(2200)

const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  if (!host) return { present: false, printCalls: window.__printCalls, dialogOpen: !!document.querySelector('.pup') }
  const rows = [...host.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => txt(td)))
  return {
    present: true,
    printCalls: window.__printCalls,
    dialogOpen: !!document.querySelector('.pup'),
    headers: [...host.querySelectorAll('thead th')].map(txt),
    rowCount: rows.length,
    rows: rows.slice(0, 3),
    totalRow: rows[rows.length - 1],
    hasUncheckedItem: txt(host).includes('YJ-KBL-012'),
    hasQty1234: txt(host).includes('1234'),
    footer: txt(host).slice(-120),
  }
})
console.log('paper(amount)=' + JSON.stringify(paper, null, 2))

// ⑤ 再开一次,切「无金额」→ 出纸核对
await page.evaluate(() => {
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
await page.waitForTimeout(500)
await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'reopen print dialog' })
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1200)
await page.click('css=.pup .el-radio-button:has-text("无金额")', { label: 'switch to no-amount (supplier)' })
await page.waitForTimeout(900)

const noAmountDlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('noAmountDlg=' + JSON.stringify(noAmountDlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-20-supplier-noamount.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }

await page.click('text=确定并打印', { label: 'confirm no-amount print (supplier)' })
await page.waitForTimeout(2200)
const paper2 = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  if (!host) return { present: false, printCalls: window.__printCalls }
  const rows = [...host.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => txt(td)))
  return {
    present: true,
    printCalls: window.__printCalls,
    headers: [...host.querySelectorAll('thead th')].map(txt),
    rowCount: rows.length,
    totalRow: rows[rows.length - 1],
    hasPriceText: /单价|小计/.test(txt(host)),
  }
})
console.log('paper(noAmount)=' + JSON.stringify(paper2, null, 2))

// 复原
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
