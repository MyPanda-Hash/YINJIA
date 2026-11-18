const task = await taskSpace('purin-singlewh')
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
  setter.call(inp, 'PI-2026-11-0004')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')?.click()
})
await page.waitForTimeout(4500)

await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('PI-2026-11-0004'))
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
  const caret = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)[0]
  caret?.click()
  await sleep(700)
  // 选 D仓
  const tr = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)[0]
  tr?.querySelector('.el-select .el-select__wrapper')?.click()
  await sleep(800)
  const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
  const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  items.find((i) => (i.textContent || '').trim() === 'D仓')?.click()
  await sleep(600)
  const foot = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  const state = { foot, okDisabled: ok?.disabled }
  if (!ok?.disabled) {
    ok.click()
    await sleep(7000)
  }
  return state
})
console.log('RES=' + JSON.stringify(res))

const after = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  return {
    msgs: [...document.querySelectorAll('.el-message')].filter(vis).map((m) => (m.textContent || '').trim()),
    dialogs: [...document.querySelectorAll('.el-dialog')].filter(vis).length,
  }
})
console.log('AFTER=' + JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-singlewh/s1.png' })
