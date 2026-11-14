const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')

async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
async function logout() {
  await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => location.reload())
  await page.waitForTimeout(4500)
}
async function login(user) {
  await page.evaluate((u) => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pw = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, u)
    if (pw) setVal(pw, '123456')
  }, user)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6500)
}
if (await jwtSub() !== 'fm') { await logout(); await login('fm') }
console.log('sub=' + (await jwtSub()))
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

const icons = await page.evaluate(() => [...document.querySelectorAll('.nc-ref')].map((el) => ({
  cls: el.className, title: el.getAttribute('title') || el.getAttribute('aria-label'), text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
})))
console.log(JSON.stringify(icons, null, 2))

// 点「消息」图标(第三个 .nc-ref 对应 msg;按 class 精确匹配)
const opened = await page.evaluate(() => {
  const el = document.querySelector('.nc-ref.type-msg') || [...document.querySelectorAll('.nc-ref')][1]
  if (!el) return 'NO-ICON'
  el.click()
  return 'OPENED'
})
console.log(opened)
await page.waitForTimeout(2500)
const panel = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const pop = document.querySelector('.notice-center .nc-pop, .nc-panel, .el-popper')
  const items = [...document.querySelectorAll('.nc-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
  return {
    hasPop: !!pop,
    head: txt(document.querySelector('.nc-head')),
    items: items.slice(0, 8),
    badge: [...document.querySelectorAll('.nc-ref')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log(JSON.stringify(panel, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-31-fm-msg.png' })
