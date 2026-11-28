// round-02:确认工厂(正式/测试)+ 模糊搜索 2026-11-26 同步进来的单 + 点开「打印」下拉看有没有「出货单」
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const env = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const storage = {}
  for (const k of Object.keys(localStorage)) storage['L:' + k] = localStorage.getItem(k)
  for (const k of Object.keys(sessionStorage)) storage['S:' + k] = sessionStorage.getItem(k)
  return {
    topbar: txt(document.querySelector('.topbar, .app-header, header')),
    bodyFirst: txt(document.body).slice(0, 200),
    dbKey: Object.entries(storage).filter(([k, v]) => /db|factory|工厂|ledger|tenant/i.test(k + '=' + v)).slice(0, 8),
  }
})
log('ENV', JSON.stringify(env, null, 2))

// 列表模糊搜索:输单号片段 → 查找
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const kw = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (kw) setVal(kw, '20261126')
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('查找'))
  btn?.click()
})
await page.waitForTimeout(3000)

const rows = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('.el-table__body tr')].map(txt).slice(0, 8)
})
log('ROWS', JSON.stringify(rows, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-02-filtered.png' })
