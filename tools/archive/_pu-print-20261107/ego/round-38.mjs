// round-38:复验明细弹窗宽度(备注列不再被压)+ 截图
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5000)
const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (atLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6500)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5000)
}
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})
await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open print dialog' })
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '清空')
  if (btn) btn.click()
})
await page.waitForTimeout(400)
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=0', { label: 'check line 1' })
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'check line 2' })
await page.waitForTimeout(500)
await page.click('text=确定并打印', { label: 'confirm print' })
await page.waitForTimeout(2000)
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2000)
await page.click('css=.pup-rec .el-table__body tbody tr >> nth=0', { label: 'open record detail' })
await page.waitForTimeout(2200)
const geo = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
  const dlg = dlgs.find((d) => txt(d.querySelector('.el-dialog__title')).includes('打印记录明细'))
  if (!dlg) return { open: false }
  const root = dlg.querySelector('.pup-detail')
  const table = root.querySelector('.el-table')
  const headers = [...root.querySelectorAll('.el-table__header th')].map(txt)
  const last = [...root.querySelectorAll('.el-table__header th')].pop()
  const b = last?.getBoundingClientRect()
  const cb = dlg.getBoundingClientRect()
  return {
    open: true,
    title: txt(dlg.querySelector('.el-dialog__title')),
    dialogWidth: Math.round(cb.width),
    tableClientW: table.clientWidth,
    tableScrollW: table.scrollWidth,
    noHScroll: table.scrollWidth <= table.clientWidth + 1,
    lastHeader: last ? txt(last) : '',
    lastHeaderRight: b ? Math.round(b.right) : null,
    dialogRight: Math.round(cb.right),
    headers,
    rowCount: root.querySelectorAll('.el-table__body tbody tr').length,
  }
})
console.log('detailGeo=' + JSON.stringify(geo, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-38-detail-wide.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }

// 收尾:关两层弹窗 + 还原 print
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
