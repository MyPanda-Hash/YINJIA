// round-05：新建「临时工单」草稿（从标准BOM带出 7 行）→ 保存草稿 → 草稿箱
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

// 回列表(上一轮提交后已在列表) → 新增
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3500)
// 切临时页签
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.wop-tabs .el-tabs__item')].find((x) => (x.textContent || '').trim() === '临时工单')
  tab?.click()
})
await sleep(900)
// 选主物料
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
console.log('选主物料=' + picked)
await sleep(2200)
// 订单数量 5
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '订单数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '5')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(800)
// 从标准BOM带出
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '从标准BOM带出')
  btn?.click()
})
await sleep(3000)
const bomRows = await page.evaluate(() => ({
  rows: document.querySelectorAll('.wop-page .el-table__body tr').length,
  first: (document.querySelector('.wop-page .el-table__body tr') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 160),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
}))
console.log('带出=' + JSON.stringify(bomRows))
// 保存草稿
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '保存草稿')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 20; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  if (toasts.some((x) => x.includes('GDD-'))) break
}
await sleep(1200)
const saved = await page.evaluate(() => ({
  hash: location.hash,
  head: (document.querySelector('.wop-head') || {}).textContent?.replace(/\s+/g, ' ').trim(),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
}))
console.log('保存临时草稿=' + JSON.stringify(saved))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r05-temp-draft.png' })

// 返回列表 → 草稿箱
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '返回列表')
  btn?.click()
})
await sleep(3200)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').includes('草稿箱'))
  btn?.click()
})
await sleep(2500)
const box = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('草稿箱') && x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()),
    badge: (() => {
      const b = [...document.querySelectorAll('.wol-btns button')].find((x) => (x.textContent || '').includes('草稿箱'))
      return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : ''
    })(),
  }
})
console.log('草稿箱=' + JSON.stringify(box, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r05-draftbox-temp.png' })
console.log('pageerrors=' + JSON.stringify(errors))
