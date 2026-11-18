// 复现:订单结转 → 选择工艺路线 弹窗,第二次打开时"上次选过的路线"看起来仍被选中,但确定按钮不可点。
// 运行:ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/round-01.mjs')"
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(4000)

const loginState = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  title: document.title,
}))
console.log('STATE1', JSON.stringify(loginState))

if (loginState.hasLogin) {
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
  await page.waitForTimeout(5000)
  console.log('STATE2', JSON.stringify(await page.evaluate(() => ({ hash: location.hash }))))
}

// 页面结构探针:工具条按钮、表格行数、是否需要点「留在本日」之类
const probe = await page.evaluate(() => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const buttons = [...document.querySelectorAll('button')].map(txt).filter(Boolean)
  const rows = document.querySelectorAll('.el-table__body-wrapper tbody tr').length
  return { hash: location.hash, buttons: buttons.slice(0, 40), tableRows: rows, bodyStart: txt(document.body).slice(0, 300) }
})
console.log('PROBE', JSON.stringify(probe, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/repro-01-page.png' })
console.log('SHOT ok')
