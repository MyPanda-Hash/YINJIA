const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 登录(正式库已是登录页常驻;工厂保持当前选中 = 测试库 YJ_TEST,不碰正式库数据)
const factory = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((el) => (el.textContent || '').includes('库'))
  return (sel?.textContent || '').replace(/\s+/g, ' ').trim()
})
console.log('factory:', factory)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
})
await page.waitForTimeout(400)
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) { b.click(); return true } return false
})
console.log('loginClicked:', btn)
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => ({ hash: location.hash, head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160) })), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-02-login.png' })
