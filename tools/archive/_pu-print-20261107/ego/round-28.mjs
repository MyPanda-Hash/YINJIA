// round-28:采购订单打印弹窗「打印记录 + 重打 + 作废」界面实测(admin)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)

// 选中 7 行订单
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)

// 打桩 window.print(不惊动打印机)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})

// 打开打印弹窗
await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open PO print dialog' })
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1500)

const initial = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    recTitle: txt(root.querySelector('.pup-rec-title')),
    recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length,
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
    rowCount: root.querySelectorAll('.pup > .el-table .el-table__body tbody tr').length,
    checked: root.querySelectorAll('.pup > .el-table .el-table__body .el-checkbox.is-checked').length,
  }
})
console.log('initial=' + JSON.stringify(initial, null, 2))

// 编辑:取消第 2 行、第 1 行数量 1234
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'uncheck line 2' })
await page.click('css=.pup > .el-table .el-input-number input >> nth=0', { label: 'focus qty line 1' })
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.type('1234')
await page.keyboard.press('Tab')
await page.waitForTimeout(700)

const edited = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    checked: document.querySelectorAll('.pup > .el-table .el-table__body .el-checkbox.is-checked').length,
    foot: txt(document.querySelector('.pup-foot')),
  }
})
console.log('edited=' + JSON.stringify(edited))

// 确定并打印(先落库再出纸)
await page.click('text=确定并打印', { label: 'confirm and print' })
await page.waitForTimeout(2200)
const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  return {
    present: !!host,
    printCalls: window.__printCalls,
    rowCount: host ? host.querySelectorAll('tbody tr').length : 0,
    total: host ? txt(host.querySelector('tbody tr.sum')) : '',
    hasRemark: txt(host || document.body).includes('10/16，送303'),
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-3),
  }
})
console.log('paper=' + JSON.stringify(paper, null, 2))

// 打印层摘除(等价 afterprint)→ 弹窗刷新记录
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2000)

const afterPrint = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  const rows = [...root.querySelectorAll('.pup-rec .el-table__body tbody tr')]
  return {
    recRows: rows.length,
    rec: rows.map(txt),
    dialogOpen: !!root,
  }
})
console.log('afterPrint=' + JSON.stringify(afterPrint, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-28-record.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-28-record.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}

// 重打:点记录里的「重打」
const clickedReprint = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr button')].find((b) => (b.textContent || '').trim() === '重打')
  if (!btn) return false
  btn.click()
  return true
})
console.log('clickedReprint=' + clickedReprint)
await page.waitForTimeout(2200)
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2000)
const afterReprint = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr')]
  return {
    rec: rows.map(txt),
    toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2),
    printCalls: window.__printCalls,
  }
})
console.log('afterReprint=' + JSON.stringify(afterReprint, null, 2))
