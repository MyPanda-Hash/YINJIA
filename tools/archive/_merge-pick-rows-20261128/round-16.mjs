// round-16:确认列名改为「可送行数」后仍然不横向溢出(截主证据图)
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (!acc || !pwd) return
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(acc, 'admin')
  setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => /生单/.test((el.querySelector('.act-name') || {}).textContent || ''))
  const caret = g && (g.querySelector('.tb-caret') || g.querySelector('.tb-main'))
  if (caret) caret.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('body *')].filter((x) => (x.textContent || '').trim() === '合单生单' && x.children.length === 0)[0]
  const target = el && (el.closest('li, .tb-item, [class*="item"]') || el)
  if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const wrap = box.querySelector('.el-table__body-wrapper')
  const ths = [...box.querySelectorAll('.el-table__header th')]
  return {
    cols: ths.map((th) => (th.textContent || '').trim()),
    overflow: wrap.scrollWidth - wrap.clientWidth,
    foot: ((box.querySelector('.el-dialog__footer') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-rows-20261128/round-16-final.png' })
await task.finish({ keep: [] })
