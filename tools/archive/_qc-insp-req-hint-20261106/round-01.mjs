const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
await page.waitForTimeout(5000)

// 会话过期则自动登录(工厂 = YJ 正式库)
const login = await page.evaluate(() => {
  const hasPwd = [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('密码'))
  return { needLogin: hasPwd, hash: location.hash, title: document.title }
})
console.log('state: ' + JSON.stringify(login))

if (login.needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://36.140.66.163:8090/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
  await page.waitForTimeout(6000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-01.png' })
console.log('shot ok')
