// round-02:切到测试账套(YJ_TEST)并打开采购入库单列表,选中草稿 PI-2026-10-0104
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return
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
}

await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(5000)
await loginIfNeeded()

// 当前工厂
const before = await page.evaluate(() => {
  const el = document.querySelector('.factory .factory-name')
  return { factory: el ? el.textContent.trim() : '(未找到)' }
})
console.log('切换前工厂:', JSON.stringify(before))

// 打开工厂下拉,选测试账套
await page.evaluate(() => {
  const el = document.querySelector('.factory')
  if (el) el.click()
})
await page.waitForTimeout(1200)
const items = await page.evaluate(() =>
  [...document.querySelectorAll('.factory-item')].map((el) => (el.textContent || '').trim()))
console.log('工厂下拉项:', JSON.stringify(items))

await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.factory-item')].find((el) => (el.textContent || '').includes('测试'))
  if (hit) hit.click()
})
await page.waitForTimeout(1500)
await shot('round-02a-factory-dialog')

// 密码框 + 确认(FactorySwitchDialog)
const dlg = await page.evaluate(() => {
  const pwd = [...document.querySelectorAll('.el-dialog input, .el-message-box input')]
  return {
    dlgTitle: [...document.querySelectorAll('.el-dialog__title')].map((e) => (e.textContent || '').trim()),
    inputCount: pwd.length,
    buttons: [...document.querySelectorAll('.el-dialog__footer button, .el-message-box__btns button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('切换弹窗:', JSON.stringify(dlg))
