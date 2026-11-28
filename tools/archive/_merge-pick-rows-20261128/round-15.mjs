// round-15:验「表头全选」与「点整行也能勾」;顺带看取消勾选会不会解除供应商锁
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
const shot = (n) => page.screenshot({ path: `C:/Users/Lenovo/ego/merge-pick-rows-20261128/round-15-${n}.png` })
const restore = async () => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
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
await restore()

const state = () => page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  return {
    foot: ((box.querySelector('.el-dialog__footer') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    chips: [...box.querySelectorAll('.mpd-bar .mpd-chip')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: trs.length,
    checked: trs.filter((tr) => (tr.querySelector('td .el-checkbox input') || {}).checked).length,
  }
})
console.log('初始=' + JSON.stringify(await state()))

// 表头全选
console.log('全选=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const head = box.querySelector('.el-table__header .el-checkbox input')
  if (!head) return 'no-head'
  head.click()
  return 'ok'
}))
await page.waitForTimeout(2500)
console.log('全选后=' + JSON.stringify(await state()))
await shot('a-select-all')

// 点整行(单据编号那格)取消/勾选一张
console.log('点行=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const tr = [...box.querySelectorAll('.el-table__body tbody tr')][1]
  if (!tr) return 'no-row'
  const td = tr.querySelectorAll('td')[2]
  td.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'ok:' + (td.textContent || '').trim()
}))
await page.waitForTimeout(1200)
console.log('点行后=' + JSON.stringify(await state()))
await shot('b-row-click')

// 取消全选
console.log('取消全选=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const head = box.querySelector('.el-table__header .el-checkbox input')
  if (!head) return 'no-head'
  head.click()
  return 'ok'
}))
await page.waitForTimeout(2500)
console.log('取消后=' + JSON.stringify(await state()))
await shot('c-clear')
await task.finish({ keep: [] })
