// round-36:矮屏(707px)验证弹窗底部按钮可见 + 内容区可滚动
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
  await page.waitForTimeout(6500)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(5500)
}

await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (row) { row.scrollIntoView({ block: 'center' }); row.click() }
})
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForSelector('.pup', { state: 'visible', timeout: 15000 })
await page.waitForTimeout(1500)

const geo = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  const footerBtn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定并打印'))
  const b = footerBtn?.getBoundingClientRect()
  return {
    innerHeight: window.innerHeight,
    footerVisible: !!b && b.top >= 0 && b.bottom <= window.innerHeight,
    footerBottom: b ? Math.round(b.bottom) : null,
    contentClientH: root.clientHeight,
    contentScrollH: root.scrollHeight,
    scrollable: root.scrollHeight > root.clientHeight + 1,
    recTitle: txt(root.querySelector('.pup-rec-title')),
    recEmpty: txt(root.querySelector('.pup-rec .el-table__empty-text')),
  }
})
console.log('geometry=' + JSON.stringify(geo, null, 2))

// 滚到内容底部,确认记录区看得见
const scrolled = await page.evaluate(() => {
  const root = document.querySelector('.pup')
  root.scrollTop = root.scrollHeight
  return { scrollTop: root.scrollTop, max: root.scrollHeight - root.clientHeight }
})
console.log('scrolled=' + JSON.stringify(scrolled))
await page.waitForTimeout(400)
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-36-scrolled.png' })
  console.log('shot=' + p)
} catch (e) { console.log('shot fail: ' + e.message) }
await page.keyboard.press('Escape')
