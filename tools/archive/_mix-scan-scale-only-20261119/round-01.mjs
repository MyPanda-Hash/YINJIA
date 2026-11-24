/**
 * round-01:登录 + 打开「扫码混料」列表,确认新前端代码已由 5173 提供。
 * 目的:拿到一份工单号/行号,供 round-02 进明细页验证「数量只读实时读数」。
 */
const task = await taskSpace('mix-scale-only-20261119')
const page = task.page('p1')

await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(3500)

// 会话可能还在,也可能在登录页:两种都兜住
const loginInfo = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return {
    hasLogin: ins.some((i) => (i.placeholder || '').includes('账号')),
    hash: location.hash,
    title: (document.body.innerText || '').slice(0, 80).replace(/\s+/g, ' '),
  }
})
console.log('login-state: ' + JSON.stringify(loginInfo))

if (loginInfo.hasLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
}

// 直达扫码混料列表页
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const dump = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.mm-row, .mp-line, tr')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return {
    hash: location.hash,
    head: (document.querySelector('.mp-title, .mm-title, h1, h2')?.innerText || '').trim(),
    bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
    rows: rows.slice(0, 8),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 12),
  }
})
console.log(JSON.stringify(dump, null, 2))

await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scale-only-20261119/round-01-list.png' })
await task.finish({ keep: [] })
