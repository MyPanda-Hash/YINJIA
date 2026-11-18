// round-01:打开「工单排产」页,确认列设置按钮在 + 表格正常渲染(2026-11-18 列设置改动后的首屏取证)
const task = await taskSpace('wo-board-column-settings-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(3500)

// 会话过期 ⇒ 登录页:按 skill 里的写法自动登录(账号 admin/123456,登录工厂 YJ=正式库)
let hash = await page.evaluate(() => location.hash)
if (hash.includes('login')) {
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
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
  await page.waitForTimeout(4000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) {
  console.log('restore skip: ' + e.message)
}

const info = await page.evaluate(() => ({
  hash: location.hash,
  列设置按钮: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '列设置'),
  表头列: [...document.querySelectorAll('.el-table__header th .cell')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  行数: document.querySelectorAll('.el-table__body tr').length,
  冻结列数: document.querySelectorAll('.el-table__header th.el-table-fixed-column--left').length,
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-01-board.png' })
