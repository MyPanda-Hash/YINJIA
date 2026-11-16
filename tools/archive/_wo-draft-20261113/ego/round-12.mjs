// round-12：用户环境 5173 实测 —— 新增(无订单数量)→ 提交 → 删除（验证「新增工单失败」是否已修）
const task = await taskSpace('wo-draft-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await sleep(2500)
let logged = !(await page.url()).includes('/login')
if (!logged) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await sleep(3500)
  logged = !(await page.url()).includes('/login')
}
console.log('5173 logged=' + logged + ' url=' + (await page.url()))
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
const listInfo = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6),
}))
console.log('5173 列表=' + JSON.stringify(listInfo))
// 打开新增页
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3800)
const pageInfo = await page.evaluate(() => ({
  hash: location.hash,
  labels: [...document.querySelectorAll('.wop-form .el-form-item__label')].map((x) => (x.textContent || '').trim()),
  hasOrderQty: [...document.querySelectorAll('.wop-form .el-form-item__label')].some((x) => (x.textContent || '').trim() === '订单数量'),
}))
console.log('5173 新增页=' + JSON.stringify(pageInfo))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r12-5173-page.png' })
// 选主物料 A-32-01
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2500)
const picked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').trim().startsWith('A-32-01 — '))
  if (!el) return false
  el.click()
  return true
})
console.log('选主物料=' + picked)
await sleep(2200)
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '生产数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '3')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(900)
// 提交
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '提交生成工单')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 30; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  const hash = await page.evaluate(() => location.hash)
  if (toasts.some((x) => x.includes('GD-')) || hash.includes('workOrderList')) break
}
await sleep(3500)
const afterCreate = await page.evaluate(() => ({
  hash: location.hash,
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 1).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220)),
}))
console.log('5173 提交后=' + JSON.stringify(afterCreate, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r12-5173-created.png' })
console.log('pageerrors=' + JSON.stringify(errors))
