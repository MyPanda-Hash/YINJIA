// 打包版(8090,jar 内 static + 新 class)核对:采购入库单工具栏是否也有「审核」
const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(4000)
let token = await page.evaluate(() => localStorage.getItem('mes_token'))
if (!token) {
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
  await page.waitForTimeout(4500)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
  await page.waitForTimeout(4000)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  docNo: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  toolbar: [...document.querySelectorAll('.tb-group .tb-main')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
})), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/purchase-in-8090-toolbar.png' })
