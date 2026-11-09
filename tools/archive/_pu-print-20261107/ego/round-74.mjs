// round-74:显式选正式库登录,验证操作列「取消带入」
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
  // 1) 打开「登录工厂」下拉,选 YINJIA-MES(正式库),避免落在测试库
  await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const sel = [...document.querySelectorAll('.el-select')].find((s) => t(s).includes('YINJIA'))
    ;(sel?.querySelector('input') || sel)?.click()
  })
  await page.waitForTimeout(800)
  const chosen = await page.evaluate(() => {
    const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
    const opt = opts.find((o) => t(o) === 'YINJIA-MES')
    if (opt) { opt.click(); return t(opt) }
    return 'none:' + opts.map((o) => t(o)).join('|')
  })
  console.log('factory=' + chosen)
  await page.waitForTimeout(500)
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
console.log('hash=' + await page.evaluate(() => location.hash))
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0)
  const row = rows.find((r) => t(r).includes('YJ-20261105-01'))
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
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
await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  it?.querySelector('.el-collapse-item__header')?.click()
})
await page.waitForTimeout(1500)
const clicked = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const btn = [...(it?.querySelectorAll('button') || [])].find((b) => t(b) === '按这次打印打码')
  if (btn) { btn.click(); return true }
  return false
})
await page.waitForTimeout(2500)
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  return {
    lock: t(root.querySelector('.mlq-lock')),
    actions: [...(it?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('button')].map((b) => t(b))),
    msgs: [...document.querySelectorAll('.el-message')].map(t).slice(-2),
  }
})
console.log('applyClicked=' + clicked)
console.log('afterApply=' + JSON.stringify(await read(), null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-74-applied.png' })
// 点操作列的「取消带入」
const cancel = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.mlq')
  const it = [...root.querySelectorAll('.mlq-collapse .el-collapse-item')].find((x) => t(x.querySelector('.el-collapse-item__header')).startsWith('打印采购订单记录'))
  const btn = [...(it?.querySelectorAll('button') || [])].find((b) => t(b) === '取消带入')
  if (btn) { btn.click(); return true }
  return false
})
await page.waitForTimeout(1800)
console.log('cancelClicked=' + cancel)
console.log('afterCancel=' + JSON.stringify(await read(), null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-74-cancelled.png' })
