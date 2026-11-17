// round-09：第二轮界面验收 —— 新增页无「订单数量」；手工单新建→删除；已排产工单删除被拒
const task = await taskSpace('wo-draft-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

const listInfo = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6),
  hasDelete: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').trim() === '删除工单'),
}))
console.log('列表=' + JSON.stringify(listInfo))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r09-list-delete-btn.png' })

// 打开新增页：确认没有「订单数量」
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3500)
const pageInfo = await page.evaluate(() => ({
  labels: [...document.querySelectorAll('.wop-form .el-form-item__label')].map((x) => (x.textContent || '').trim()),
  hasOrderQty: [...document.querySelectorAll('.wop-form .el-form-item__label')].some((x) => (x.textContent || '').trim() === '订单数量'),
  required: [...document.querySelectorAll('.wop-form .el-form-item.is-required .el-form-item__label')].map((x) => (x.textContent || '').trim()),
}))
console.log('新增页=' + JSON.stringify(pageInfo))

// 选主物料 + 生产数量 7
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2200)
const picked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').trim().startsWith('A-32-01 — '))
  if (!el) return false
  el.click()
  return true
})
await sleep(2000)
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '生产数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '7')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(800)
console.log('选主物料=' + picked)
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
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 2).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
}))
console.log('提交后=' + JSON.stringify(afterCreate, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r09-created.png' })

// 勾选刚建的行 → 删除工单 → 确认
const rowNo = (afterCreate.rows[0] || '').match(/GD-\d{4}-\d{2}-\d{4}/)?.[0] || ''
console.log('目标工单=' + rowNo)
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '删除工单')
  btn?.click()
})
await sleep(1200)
const confirmBox = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
  return box ? (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) : null
})
console.log('删除确认框=' + JSON.stringify(confirmBox))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r09-delete-confirm.png' })
// 点确认
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
  const btn = [...box.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '确认')
  btn?.click()
})
let delToast = []
for (let i = 0; i < 16; i++) {
  await sleep(350)
  delToast = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  if (delToast.length) break
}
await sleep(1500)
console.log('删除后提示=' + JSON.stringify(delToast))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r09-deleted.png' })
console.log('pageerrors=' + JSON.stringify(errors))
