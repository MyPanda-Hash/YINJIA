// round-03:登录(admin/123456,YINJIA-MES) → 打开采购订单列表并等数据
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(2500)

await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const user = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (user) setVal(user, 'admin')
  if (pwd) setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
console.log('after login hash=' + (await page.evaluate(() => location.hash)))

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tbody tr')].map(txt).filter(Boolean)
  const rail = [...document.querySelectorAll('[class*="rail"]')].map((el) => el.className).slice(0, 10)
  return {
    hash: location.hash,
    title: document.title,
    panelTitle: txt(document.querySelector('.panel-title, .doc-title, .px-title')),
    buttons: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 40),
    rowCount: rows.length,
    firstRows: rows.slice(0, 3),
    rail,
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-03-list.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
