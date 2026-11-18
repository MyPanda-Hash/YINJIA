const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_JJF', { timeout: 30000 })
await page.waitForTimeout(3000)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin:', needLogin)
if (needLogin) {
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
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_JJF', { timeout: 30000 })
  await page.waitForTimeout(4000)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => ({
  hash: location.hash,
  hasSheet: !!document.querySelector('.approval-sheet'),
  factory: [...document.querySelectorAll('.el-select__placeholder, .el-input__inner')].slice(0, 6).map(e => (e.textContent || e.value || '').trim()),
  btnTexts: [...document.querySelectorAll('.as-side-btns *')].map(b => (b.textContent || '').trim()).filter(t => t && t.length < 12),
  rowTexts: [...document.querySelectorAll('.as-row')].map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 20),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r01-current.png' })
console.log('done')
