/**
 * 其他退料「退到仓库」可自选 —— 第 01 轮:登录(测试库 YJ_TEST)+ 打开其他退料扫码页 + 扫一个库存里有货的物料。
 * 复跑:ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/other-ret-wh-20261119/round-01.mjs')"
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(3500)

// 1) 账号 / 密码
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

// 2) 登录工厂 = 测试库(下拉是 Element Plus 自定义组件,直接点开再点选项)
await page.evaluate(() => {
  const sel = document.querySelector('.login-form .el-select')
  if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
})
await page.waitForTimeout(900)
const factoryOptions = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('工厂下拉:', JSON.stringify(factoryOptions))

await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')]
    .find((el) => (el.textContent || '').includes('测试库'))
  if (opt) opt.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(600)
const picked = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select .el-select__selected-item')
  return el ? (el.textContent || '').trim() : ''
})
console.log('已选工厂:', picked)

// 3) 进入系统
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
console.log('登录后 hash:', await page.evaluate(() => location.hash))

// 4) 其他退料扫码页
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET', { timeout: 40000 })
await page.waitForTimeout(4000)
console.log('页面 hash:', await page.evaluate(() => location.hash))
console.log('标题:', await page.evaluate(() => (document.querySelector('.mo-title') || {}).textContent || '(空)'))
console.log('仓库档已拉到:', await page.evaluate(() => document.body.innerText.includes('其他退料清单')))

// 5) 扫一个库存里确实有货的物料(测试库:YJ-CH-016 标签 @ 华北工控仓 CK00006)
await page.fill('.mo-scanbar input', 'YJ-CH-016')
await page.press('.mo-scanbar input', 'Enter')
await page.waitForTimeout(4500)

const state = await page.evaluate(() => {
  const cand = document.querySelector('.mo-cand')
  const wh = document.querySelector('.mo-wh')
  const selInput = document.querySelector('.mo-wh .el-select input')
  return {
    cand: cand ? (cand.textContent || '').replace(/\s+/g, ' ').trim() : null,
    hasWhBlock: !!wh,
    whLabel: wh ? (wh.querySelector('.mo-qty-label') || {}).textContent : null,
    whValue: selInput ? selInput.value : null,
    whHint: wh && wh.querySelector('.mo-wh-hint') ? wh.querySelector('.mo-wh-hint').textContent : null,
  }
})
console.log('扫码后:', JSON.stringify(state, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-01-scan.png' })
console.log('截图: round-01-scan.png')
