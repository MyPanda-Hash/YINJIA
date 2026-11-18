const task = await taskSpace('purin-whgroup')
const page = task.page('p1')

// 硬刷新,别让页面拿着上一轮的旧数据
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

const prep = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  if (location.hash.includes('login')) return 'login'
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (!inp) return 'no-search'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'PI-2026-11-0008')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')?.click()
  await sleep(4500)
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('PI-2026-11-0008'))
  if (!tr) return 'no-row'
  tr.click()
  await sleep(4500)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  if (!btn) return 'no-button'
  btn.click()
  await sleep(3500)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return 'no-dialog'
  const lines = [...dlg.querySelectorAll('.el-table__body-wrapper tr:not(.pmw-alloc-row)')].filter(vis)
  return { first: (lines[0]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), lineCount: lines.length }
})
console.log('PREP=' + JSON.stringify(prep))

// 第 1 行加两行:D仓 6 / C仓 4
const r1 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0].click(); await sleep(600); carets[0].click(); await sleep(800)
  const a = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const setQty = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur()
  }
  setQty(a[0].querySelector('.el-input-number input'), '6')
  await sleep(400)
  a[1].querySelector('.el-select .el-select__wrapper')?.click()
  await sleep(900)
  const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
  const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const hit = items.find((i) => (i.textContent || '').trim() === 'C仓')
  hit?.click(); await sleep(400)
  setQty(a[1].querySelector('.el-input-number input'), '4')
  await sleep(500)
  const foot = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  return { allocs: a.length, foot, disabled: ok?.disabled, picked: !!hit }
})
console.log('R1=' + JSON.stringify(r1))

if (!r1.disabled) {
  await page.evaluate(() => {
    const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
    const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
    ;[...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')?.click()
  })
  await page.waitForTimeout(8000)
}
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whgroup/g7-after-split.png' })
console.log('split done')
