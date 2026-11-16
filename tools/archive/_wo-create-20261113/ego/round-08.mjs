// round-08：界面新建「临时工单」（主物料 A-32-01 → 从标准BOM带出 → 保存）→ 搜出该行 → 物料清单弹窗
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

// ① 按工单号搜出上一轮界面新建的常规工单，确认 工单类型=常规
async function search(no) {
  await page.evaluate((v) => {
    const inp = document.querySelector('.wol-query input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }, no)
  await sleep(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
    btn?.click()
  })
  await sleep(3000)
  return page.evaluate(() => {
    const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
    return [...document.querySelectorAll('.wol-table .el-table__body tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
      const o = {}
      ths.forEach((h, i) => { if (h) o[h] = tds[i] })
      return o
    })
  })
}
const normalRows = await search('GD-2026-11-0011')
console.log('① 界面新建的常规工单行=' + JSON.stringify(normalRows[0] || {}).slice(0, 700))

// ② 新建临时工单
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await page.waitForSelector('.woc-dlg', { state: 'visible', timeout: 8000 })
await sleep(2200)
// 切到「临时工单」页签
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.woc-tabs .el-tabs__item')].find((x) => (x.textContent || '').trim() === '临时工单')
  tab?.click()
})
await sleep(800)
const tabState = await page.evaluate(() => ({
  alert: (document.querySelector('.woc-dlg .el-alert') || {}).textContent?.trim() || '',
  subTitle: (document.querySelector('.woc-dlg .woc-sub-t') || {}).textContent?.trim() || '',
  tableHeaders: [...document.querySelectorAll('.woc-dlg .el-table th')].map((x) => (x.textContent || '').trim()),
  tableRows: document.querySelectorAll('.woc-dlg .el-table__body tr').length,
}))
console.log('② 临时页签=' + JSON.stringify(tabState))

// 选主物料 A-32-01（精确的那个，不带 **TB）
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2200)
const choseProduct = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').trim().startsWith('A-32-01 — '))
  if (!el) return false
  el.click()
  return true
})
console.log('② 选主物料 A-32-01（精确）=' + choseProduct)
await sleep(2000)
// 订单数量 = 5
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.woc-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '订单数量')
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
  const btn = [...document.querySelectorAll('.woc-dlg button')].find((b) => (b.textContent || '').trim() === '从标准BOM带出')
  btn?.click()
})
await sleep(3000)
const afterBom = await page.evaluate(() => ({
  rows: document.querySelectorAll('.woc-dlg .el-table__body tr').length,
  first: (document.querySelector('.woc-dlg .el-table__body tr') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 200),
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
}))
console.log('② 从标准BOM带出=' + JSON.stringify(afterBom))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r08-temp-bom-loaded.png' })

// 保存
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.woc-dlg')].find((x) => x.getBoundingClientRect().width > 100)
  const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '保存')
  btn?.click()
})
// 立刻抓 toast
let toasts = []
for (let i = 0; i < 12; i++) {
  await sleep(300)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()))
  if (toasts.length) break
}
console.log('② 保存 toast=' + JSON.stringify(toasts))
await sleep(3500)
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r08-temp-saved.png' })
console.log('pageerrors=' + JSON.stringify(errors))
