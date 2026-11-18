/**
 * 第 06 轮:换到 8090(打包版 jar 里的 static)复检 —— 确认新前端真的发出去了。
 * 只读:扫一条料看「退到仓库」出来没有,**不提交**(8090 = 正式库 HSDZ_MES,不造业务单)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 40000 })
await page.waitForTimeout(3500)
const needLogin = await page.evaluate(() => !!document.querySelector('.login-form'))
console.log('需要登录:', needLogin)

if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('登录账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('登录密码'))
    if (acc) setVal(acc, 'admin')
    if (pwd) setVal(pwd, '123456')
  })
  // 登录工厂 = 正式库 YINJIA-MES
  await page.evaluate(() => {
    const sel = document.querySelector('.login-form .el-select')
    if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')]
      .find((el) => (el.textContent || '').trim() === 'YINJIA-MES')
    if (opt) opt.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(7000)
  console.log('登录后 hash:', await page.evaluate(() => location.hash))
  console.log('账套:', await page.evaluate(() => localStorage.getItem('mes_factory')))
}

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_OTHER_RET', { timeout: 40000 })
await page.waitForTimeout(4000)
console.log('页面 hash:', await page.evaluate(() => location.hash))
console.log('入口 chunk:', await page.evaluate(() => [...document.querySelectorAll('script')]
  .map((s) => s.src).filter((s) => s.includes('index-')).join(',')))

await page.fill('.mo-scanbar input', 'YJ-CH-016')
await page.press('.mo-scanbar input', 'Enter')
await page.waitForTimeout(4500)
const state = await page.evaluate(() => ({
  title: (document.querySelector('.mo-title') || {}).textContent,
  candCount: document.querySelectorAll('.mo-cand').length,
  hasWhBlock: !!document.querySelector('.mo-wh'),
  whLabel: (document.querySelector('.mo-wh .mo-qty-label') || {}).textContent,
  whSelected: (document.querySelector('.mo-wh .el-select') || {}).textContent,
}))
console.log('8090 上扫完:', JSON.stringify(state, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-06-8090.png' })
console.log('截图: round-06-8090.png')
