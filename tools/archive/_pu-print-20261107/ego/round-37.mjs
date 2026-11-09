// round-37:点「已打印记录」一行 → 记录明细弹窗(admin)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

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

// 选中 7 行订单 → 开打印弹窗
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
await page.waitForTimeout(1500)

// 只选前两行(清空 → 勾 1、2)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '清空')
  if (btn) btn.click()
})
await page.waitForTimeout(400)
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=0', { label: 'check line 1' })
await page.click('css=.pup > .el-table .el-table__body tbody tr .el-checkbox >> nth=1', { label: 'check line 2' })
await page.waitForTimeout(600)
const beforePrint = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return { checked: document.querySelectorAll('.pup > .el-table .el-table__body .el-checkbox.is-checked').length, foot: txt(document.querySelector('.pup-foot')) }
})
console.log('beforePrint=' + JSON.stringify(beforePrint))

await page.click('text=确定并打印', { label: 'confirm print' })
await page.waitForTimeout(2200)
await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
await page.waitForTimeout(2200)
const rec = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr')]
  return { recRows: rows.length, rec: rows.map(txt), title: txt(document.querySelector('.pup-rec-title')) }
})
console.log('record=' + JSON.stringify(rec, null, 2))

// 真实点击记录行 → 记录明细
await page.click('css=.pup-rec .el-table__body tbody tr >> nth=0', { label: 'open record detail' })
await page.waitForTimeout(2500)
const detail = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
  const dlg = dlgs.find((d) => txt(d.querySelector('.el-dialog__title')).includes('打印记录明细'))
  if (!dlg) return { open: false, titles: dlgs.map((d) => txt(d.querySelector('.el-dialog__title'))) }
  const root = dlg.querySelector('.pup-detail')
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    open: true,
    title: txt(dlg.querySelector('.el-dialog__title')),
    bar: txt(root.querySelector('.pup-bar')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    rowCount: rows.length,
    rows: rows.map(txt),
    footer: [...dlg.querySelectorAll('.el-dialog__footer button')].map(txt),
  }
})
console.log('detail=' + JSON.stringify(detail, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-37-record-detail.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }

// 关闭明细 + 作废记录(清理)
await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
  const dlg = dlgs.find((d) => (d.querySelector('.el-dialog__title')?.textContent || '').includes('打印记录明细'))
  const btn = [...(dlg?.querySelectorAll('.el-dialog__footer button') || [])].find((b) => (b.textContent || '').trim() === '关闭')
  if (btn) btn.click()
})
await page.waitForTimeout(900)
const voided = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec .el-table__body tbody tr button')].find((b) => (b.textContent || '').trim() === '作废')
  if (!btn) return 'no void button'
  btn.click()
  return 'clicked void'
})
console.log(voided)
await page.waitForTimeout(900)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => (b.textContent || '').trim() === '确定')
  if (btn) btn.click()
})
await page.waitForTimeout(1800)
console.log('afterVoid=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return { recRows: root.querySelectorAll('.pup-rec .el-table__body tbody tr').length, empty: txt(root.querySelector('.pup-rec .el-table__empty-text')), toast: [...document.querySelectorAll('.el-message')].map(txt).filter(Boolean).slice(-2) }
})))

await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
