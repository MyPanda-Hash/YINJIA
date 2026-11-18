const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
// 清登录态 → 回登录页,用**测试库**(YJ_TEST)登录(正式库只录真实业务)
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const loginInfo = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || ''),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('login page:', JSON.stringify(loginInfo))

// 选「登录工厂」= 测试库
const picked = await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  if (!sel) return 'no-select'
  const inner = sel.querySelector('.el-select__wrapper, .el-input__inner') || sel
  inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'clicked'
})
await page.waitForTimeout(700)
const optTexts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((i) => (i.textContent || '').trim()))
console.log('factory options:', JSON.stringify(optTexts), 'pick:', picked)
const okPick = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const t = items.find((i) => (i.textContent || '').includes('测试'))
  if (!t) return false
  t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return true
})
console.log('picked 测试库:', okPick)
await page.waitForTimeout(500)

// 账号密码 + 进入系统
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
console.log('after login hash:', await page.evaluate(() => location.hash))

const docNo = process.env.JJF_NO || 'JJF-2026-11-0005'
await page.goto(`http://localhost:5173/#/panelx/list/QC_JJF?docNo=${docNo}`, { timeout: 30000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const dump = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('.el-select__selected-item, .el-select__placeholder') || {}).textContent || '',
  info: [...document.querySelectorAll('.as-info-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.as-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  footer: [...document.querySelectorAll('.as-foot-row, .as-footer, .as-sign, .q-signline')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 20),
  btns: [...document.querySelectorAll('.as-side-btns *')].map((b) => (b.textContent || '').trim()).filter((t) => t && t.length < 14),
  status: (document.querySelector('.el-tag, .dt-tab.on') || {}).textContent || '',
}))
console.log(JSON.stringify(dump, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r02-sheet.png' })
console.log('done')
