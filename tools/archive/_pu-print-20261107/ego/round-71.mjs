// round-71:按这次打印打码后 —— 数量/行锁定,只能改批次号与生产日期
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(3500)
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
  await page.waitForTimeout(7000)
}
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
const pick = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
  const row = rows.find((r) => t(r).includes('YJ-20261105-01'))
  if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return 'ok' }
  return 'none'
})
console.log('pick=' + pick)
await page.waitForTimeout(2600)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const g = [...document.querySelectorAll('.tb-group')].find((el) => t(el).startsWith('打印'))
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const it = [...document.querySelectorAll('.ctx-item, .el-dropdown-menu__item, .tb-drop li')].find((el) => t(el) === '打印材料码')
  it?.click()
})
await page.waitForTimeout(4500)
// 展开打印采购订单记录并点「按这次打印打码」
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  it?.querySelector('.el-collapse-item__header')?.click()
})
await page.waitForTimeout(1500)
const before = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const btn = [...(it?.querySelectorAll('button') || [])].find((b) => t(b) === '按这次打印打码')
  if (btn) btn.click()
  return { clicked: !!btn }
})
await page.waitForTimeout(2500)
const state = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  if (!root) return { open: false }
  const qty = [...root.querySelectorAll('.el-table__body tbody tr .el-input-number input')].map((i) => ({ v: i.value, disabled: i.disabled }))
  const checks = [...root.querySelectorAll('.el-table__body tbody tr .el-checkbox input')].map((i) => ({ checked: i.checked, disabled: i.disabled }))
  const batch = [...root.querySelectorAll('.el-input input')].map((i) => ({ v: i.value, disabled: i.disabled }))
  const lock = t(root.querySelector('.mlq-lock'))
  const buttons = [...root.querySelectorAll('.el-dialog__footer button, .mlq + * button')].map((b) => t(b))
  return { lock, qty, checks, inputs: batch, footerButtons: buttons }
})
console.log('clicked=' + JSON.stringify(before))
console.log('state=' + JSON.stringify(state, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-71-locked.png' })
