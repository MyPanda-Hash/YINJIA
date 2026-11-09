// round-33:确认系统可用(打开采购订单页;未登录则 admin 登录),截图
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(4500)
const atLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (atLogin) {
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
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(4500)
}
const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}') || {}
  return {
    hash: location.hash,
    title: document.title,
    user: u.userName,
    rows: [...document.querySelectorAll('tbody tr')].length,
    firstRows: [...document.querySelectorAll('tbody tr')].slice(0, 3).map(txt),
    toolbar: [...document.querySelectorAll('.tb-group')].map(txt),
  }
})
console.log('system=' + JSON.stringify(info, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-33-system.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-33-system.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}
