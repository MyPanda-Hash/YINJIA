import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
console.log('space=' + task.spaceId)
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(3500)

let info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="密码"]'),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
}))
console.log(JSON.stringify(info, null, 2))

if (info.hasLogin) {
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
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
  await page.waitForTimeout(3500)
  info = await page.evaluate(() => ({
    hash: location.hash,
    hasLogin: !!document.querySelector('input[placeholder*="密码"]'),
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  }))
  console.log('after-login=' + JSON.stringify(info))
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.screenshot({ path: OUT + '/r01-list.png' })
console.log('shot=r01-list.png')
