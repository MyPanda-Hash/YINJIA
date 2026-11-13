const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (!acc || !pwd) return 'NO-INPUT'
  setVal(acc, 'zfy')
  setVal(pwd, '123456')
  return 'OK'
})
console.log('fill=' + filled)
await page.waitForTimeout(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    hash: location.hash,
    factory: localStorage.getItem('mes_factory'),
    user: localStorage.getItem('mes_user'),
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    msg: [...document.querySelectorAll('.el-message')].map((m) => txt(m)),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-21-zfy-login.png' })
