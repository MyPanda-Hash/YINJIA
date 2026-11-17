// 2026-11-13 round-12:取证截图(把日期列横向滚到可见处,拍红格 + 汇总条)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'
const SHOT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function gotoHash(path) {
  await page.evaluate((p) => { location.href = '/index.html?bust=' + Date.now() + '#' + p }, path)
  await page.waitForTimeout(8000)
  await restoreWindow()
  if (await page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
    await page.evaluate(() => {
      const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
      const ins = [...document.querySelectorAll('input')]
      setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
      setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
      document.querySelector('.login-form .el-select')?.click()
    })
    await page.waitForTimeout(1200)
    await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') }); if (el) el.click() })
    await page.waitForTimeout(500)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
    await page.waitForTimeout(6500)
    await page.evaluate((p) => { location.href = '/index.html?bust=' + Date.now() + '#' + p }, path)
    await page.waitForTimeout(8000)
    await restoreWindow()
  }
}
async function pickLine(name) {
  await page.evaluate((n) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(n))
    if (el) el.click()
  }, name)
  await page.waitForTimeout(3500)
}
async function scrollRight(sel) {
  return page.evaluate((s) => {
    const root = document.querySelector(s)
    if (!root) return 'no-root'
    let n = 0
    root.querySelectorAll('.el-scrollbar__wrap, .el-table__body-wrapper, .el-scrollbar__view').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 10) { el.scrollLeft = el.scrollWidth; n++ }
    })
    return 'scrolled:' + n
  }, sel)
}

await gotoHash('/prod/plan/workOrderBoard')
await pickLine('3号车间')
console.log('scroll3=' + (await scrollRight('.wb-main')))
await page.waitForTimeout(1200)
console.log('3号车间=' + JSON.stringify(await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  cell: (document.querySelector('.wb-main .el-table__body tr.el-table__row .dp-plan.actual') || {}).textContent?.trim() || '',
  cellTitle: (document.querySelector('.wb-main .el-table__body tr.el-table__row .dp-plan.actual') || {}).getAttribute?.('title') || '',
}))))
await page.screenshot({ path: SHOT + 'final-01b-board-3shop.png' })

await pickLine('1号车间')
console.log('scroll1=' + (await scrollRight('.wb-main')))
await page.waitForTimeout(1200)
const snap1 = await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  red: [...document.querySelectorAll('.wb-main .dp-plan.short')].map((el) => ({ t: (el.textContent || '').trim(), title: el.getAttribute('title') })),
}))
console.log('1号车间=' + JSON.stringify(snap1))
await page.screenshot({ path: SHOT + 'final-02b-board-1shop.png' })

await gotoHash('/prod/plan/workOrderList')
console.log('scroll-list=' + (await scrollRight('.wol-table')))
await page.waitForTimeout(1200)
const snapList = await page.evaluate(() => ({
  banner: (document.querySelector('.wol-short') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  red: [...document.querySelectorAll('.wol-table .dp-plan.short')].slice(0, 5).map((el) => (el.textContent || '').trim()),
}))
console.log('list=' + JSON.stringify(snapList))
await page.screenshot({ path: SHOT + 'final-03b-list.png' })
console.log('DONE')
