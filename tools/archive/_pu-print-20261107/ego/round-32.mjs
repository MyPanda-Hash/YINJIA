// round-32:把 5173 浏览器恢复成 admin 登录
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/scm/supplierPrint', { timeout: 40000 })
await page.waitForTimeout(3500)
console.log('before=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { userName: u.userName, supplierCode: u.supplierCode || null, hash: location.hash }
})))

// 供应商布局的账号菜单
try {
  await page.click('css=.psb-user', { label: 'open account menu' })
  await page.waitForTimeout(1000)
  await page.click('text=退出登录', { label: 'logout supplier' })
  await page.waitForTimeout(3200)
} catch (e) { console.log('logout: ' + e.message) }

await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号'))
  const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin')
  if (p) setVal(p, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6500)
console.log('restored=' + JSON.stringify(await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return { userName: u.userName, isAdmin: u.isAdmin, hash: location.hash }
})))
