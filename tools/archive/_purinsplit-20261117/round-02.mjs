const task = await taskSpace('purin-manualqty')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'PI-2026-11-0002')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')?.click()
})
await page.waitForTimeout(4500)

await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('PI-2026-11-0002'))
  tr?.click()
})
await page.waitForTimeout(4500)

await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  btn?.click()
})
await page.waitForTimeout(3500)

const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return { err: 'no-dialog' }
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0].click(); await sleep(500); carets[0].click(); await sleep(600)
  const allocs = () => [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const setQty = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.blur()
  }
  let a = allocs()
  const secondDisabled = a[1].querySelector('.el-input-number input')?.disabled
  setQty(a[0].querySelector('.el-input-number input'), '3700')
  await sleep(300)
  setQty(a[1].querySelector('.el-input-number input'), '300')
  await sleep(400)
  const footEq = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  a = allocs()
  setQty(a[1].querySelector('.el-input-number input'), '500')
  await sleep(500)
  const footOver = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  return {
    secondRowEditable: !secondDisabled,
    q1: allocs()[0].querySelector('.el-input-number input')?.value,
    q2: allocs()[1].querySelector('.el-input-number input')?.value,
    footEq, footOver, okDisabledOver: ok?.disabled,
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-manualqty/m1-over.png' })
