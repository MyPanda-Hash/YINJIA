// round-01:登录取证 + 打开「出货检验计划表」面板,看结构
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(4000)

// 需要登录时就登录(admin/123456,登录工厂保持默认 = YJ 正式库)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc && pwd) {
    setVal(acc, 'admin'); setVal(pwd, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  }
})
await page.waitForTimeout(5000)
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1500),
  tabs: [...document.querySelectorAll('.el-tabs__item')].map((e) => e.textContent.trim()),
  tables: document.querySelectorAll('table').length,
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-01.png' })
