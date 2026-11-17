const task = await taskSpace('purin-whgroup')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(9000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// 选中单据
const picked = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  if (location.hash.includes('login')) return 'login'
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (!inp) return 'no-search'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'PI-2026-11-0008')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')?.click()
  await sleep(4000)
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('PI-2026-11-0008'))
  if (!tr) return 'no-row'
  tr.click()
  await sleep(4000)
  return 'ok'
})
console.log('pick=' + picked)

// 开弹窗 → 第 1 行点 ▾ 两次,分两个仓库
const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  if (!btn) return 'no-button'
  btn.click()
  await sleep(2600)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0]?.click()
  await sleep(500)
  carets[0]?.click()
  await sleep(600)
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  return {
    lines: [...dlg.querySelectorAll('.el-table__body-wrapper tr:not(.pmw-alloc-row)')].filter(vis).length,
    allocs: allocs.map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)),
  }
})
console.log('OPEN=' + JSON.stringify(res))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whgroup/g1-open.png' })
