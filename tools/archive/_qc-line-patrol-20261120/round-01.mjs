const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(4000)
// 登录态?
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin=' + needLogin)
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  const sel = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input, .el-select')].find((e) => (e.placeholder || '').includes('工厂'))
    return !!el
  })
  console.log('factorySelect=' + sel)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
  await page.waitForTimeout(4500)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/01-list.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  bodyHead: (document.body.innerText || '').slice(0, 600),
  sheets: document.querySelectorAll('.lp-sheet').length,
})), null, 2))
await task.finish({ keep: [] })
