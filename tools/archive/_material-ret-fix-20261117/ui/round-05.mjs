const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/', { timeout: 40000 })
await page.waitForTimeout(3500)

const rectOf = async (sel, text) => await page.evaluate(({ sel, text }) => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, '').trim()
  const el = [...document.querySelectorAll(sel)].find((e) => t(e) === text)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }
}, { sel, text })

// ① 悬停一级「WMS管理」→ 展开分组浮层
const g = await rectOf('.nav-group', 'WMS管理')
console.log('WMS管理 rect=' + JSON.stringify(g))
if (g) { await page.mouse.move(g.x, g.y, { label: 'hover WMS管理' }); await page.waitForTimeout(1200) }

// ② 浮层里悬停「库存明细」
const d = await rectOf('.el-dropdown-menu__item, .nav-fly-item, li, div', '库存明细')
console.log('库存明细 rect=' + JSON.stringify(d))
if (d) { await page.mouse.move(d.x, d.y, { label: 'hover 库存明细' }); await page.waitForTimeout(1200) }

const state = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    popups: [...document.querySelectorAll('.el-dropdown-menu, .nav-flyout, [class*="fly"]')].map(txt).slice(0, 3),
    visibleText: [...document.querySelectorAll('.el-dropdown-menu__item, .nav-flyout a, .nav-flyout div')].map(txt).filter(Boolean).slice(0, 40),
  }
})
console.log(JSON.stringify(state, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-05-menu.png' })
