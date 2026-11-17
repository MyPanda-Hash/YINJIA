import fsp from 'node:fs/promises'

const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
await fsp.mkdir(DIR, { recursive: true })

const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
await page.waitForTimeout(4000)

// 登录页就自动登录(YJ = 正式库)
const logged = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const user = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (!user || !pwd) return false
  setVal(user, 'admin')
  setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
  return true
})
if (logged) {
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
  await page.waitForTimeout(5000)
}

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-row, .dsr li, [class*="dsr-"]')].length
  return {
    hash: location.hash,
    title: document.title,
    dsrBlocks: rows,
    railHtml: (document.querySelector('[class*="dsr"]')?.className || ''),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 20).slice(0, 60),
  }
})
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: DIR + '/round-01-list.png' })
await task.finish({ keep: true })
