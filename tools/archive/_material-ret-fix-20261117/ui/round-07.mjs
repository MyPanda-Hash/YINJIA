const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', { timeout: 45000 })
await page.waitForTimeout(4000)

let loggedIn = !(await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]')))
if (!loggedIn) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', { timeout: 45000 })
  await page.waitForTimeout(4000)
}

const state = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const body = txt(document.body)
  return {
    hash: location.hash,
    hasError: body.includes('服务异常') || body.includes('列名'),
    factory: (body.match(/YINJIA-MES[·\s]*测试库|YINJIA-MES(?!·)/) || [''])[0],
    docNo: (document.querySelector('input') || {}).value || null,
    gridCols: [...document.querySelectorAll('.el-table__header th, thead th')].map(txt).filter(Boolean).slice(0, 30),
    entry: [...document.querySelectorAll('script[src*="assets/index-"]')].map((s) => s.getAttribute('src')),
  }
})
console.log(JSON.stringify(state, null, 2))

// 悬停 WMS管理 → 看「库存明细」下的两张明细表
const rectOf = async (sel, text) => await page.evaluate(({ sel, text }) => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, '').trim()
  const el = [...document.querySelectorAll(sel)].find((e) => t(e) === text)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
}, { sel, text })
const g = await rectOf('.nav-group', 'WMS管理')
if (g) { await page.mouse.move(g.x, g.y, { label: 'hover WMS管理' }); await page.waitForTimeout(1500) }
const d = await rectOf('.el-dropdown-menu__item, li, div', '库存明细')
if (d) { await page.mouse.move(d.x, d.y, { label: 'hover 库存明细' }); await page.waitForTimeout(1500) }

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-07-8090.png' })
