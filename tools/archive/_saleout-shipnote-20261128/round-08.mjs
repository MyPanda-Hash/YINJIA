// round-08:登录(进入系统)→ 用 hash 路由进销售出库单(不整页重载,保会话)→ 模糊搜索 20261126
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.evaluate(() => {
  const setVal = (el, v) => {
    if (!el) return
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
})
await page.waitForTimeout(400)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (!btn) return false
  btn.click(); return true
})
log('点击进入系统=', clicked)
await page.waitForTimeout(8000)
log('登录后=', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: JSON.parse(localStorage.getItem('mes_factory') || '{}'),
  token: !!localStorage.getItem('mes_token'),
}))))

// hash 路由跳销售出库单(不整页重载)
await page.evaluate(() => { location.hash = '#/panelx/list/SALE_OUT' })
await page.waitForTimeout(6000)
log('面板页=', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  body: (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
}))))

// 模糊搜索
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
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await page.waitForTimeout(4000)
const rows = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8))
log('ROWS=', JSON.stringify(rows, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-08-list.png' })
