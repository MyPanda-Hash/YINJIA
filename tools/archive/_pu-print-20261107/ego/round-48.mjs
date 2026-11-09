// round-48:打印弹窗「可打印上限」取证(主按钮=打印采购订单;超送 20% ⇒ 3000→3600)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(5500)
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
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5500)
}

await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261105-05') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)

// 打印组主按钮 → 直接开「打印采购订单」弹窗
await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => txt(el).startsWith('打印'))
  const main = g?.querySelector('.tb-main') || g?.querySelector('button')
  if (main) main.click()
})
await page.waitForTimeout(4000)
const state = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => txt(d).includes('打印采购订单'))
  if (!dlg) return { open: false }
  const headers = [...dlg.querySelectorAll('.el-table__header th')].map(txt)
  const rows = [...dlg.querySelectorAll('.el-table__body tbody tr')].slice(0, 4).map((tr) => [...tr.children].map(txt))
  return {
    open: true,
    title: txt(dlg.querySelector('.el-dialog__title')),
    quotaTip: txt(dlg.querySelector('.pup-quota-tip')),
    headers,
    rows,
    inputs: [...dlg.querySelectorAll('.el-table__body tbody tr .el-input-number input')].slice(0, 4).map((i) => i.value),
  }
})
console.log('dialog=' + JSON.stringify(state, null, 1))

if (state.open) {
  const typed = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => txt(d).includes('打印采购订单'))
    const inp = dlg?.querySelector('.el-table__body tbody tr .el-input-number input')
    if (!inp) return 'no input'
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    inp.focus()
    s.call(inp, '3601')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.blur()
    return inp.value
  })
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => txt(d).includes('打印采购订单'))
    return dlg?.querySelector('.el-table__body tbody tr .el-input-number input')?.value
  })
  console.log('typed=' + typed + ' → after=' + after)
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-48-print-cap.png' })
  await page.keyboard.press('Escape')
}
