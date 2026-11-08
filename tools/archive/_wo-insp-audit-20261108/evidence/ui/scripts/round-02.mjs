// round-02: 确认识别登录页 → 选「登录工厂 = 测试库 YJ_TEST」→ admin/123456 登录 → 校验 JWT factory
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const claims = async () => page.evaluate(() => {
  const tok = localStorage.getItem('mes_token') || ''
  try {
    const p = tok.split('.')[1]
    return JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/')))))
  } catch (e) { return null }
})

await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)

// ① 定位「登录工厂」下拉(el-select:显示文本恰为 YINJIA-MES 的那个;语言下拉是简体的)
const factorySel = await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')]
  const target = sels.find((s) => (s.innerText || '').trim().startsWith('YINJIA-MES') && !/测试/.test(s.innerText || ''))
  if (!target) return { found: false, all: sels.map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()) }
  return { found: true, text: (target.innerText || '').replace(/\s+/g, ' ').trim() }
})
console.log('factory select:', JSON.stringify(factorySel))
if (!factorySel.found) throw new Error('没找到登录工厂下拉')

// ② 点开下拉,列出选项
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')]
  const target = sels.find((s) => (s.innerText || '').trim().startsWith('YINJIA-MES') && !/测试/.test(s.innerText || ''))
  const inner = target.querySelector('.el-select__wrapper, .el-input__wrapper, input') || target
  inner.click()
})
await page.waitForTimeout(800)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((el) => el.offsetParent !== null).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('factory options:', JSON.stringify(opts))
await page.screenshot({ path: OUT + '/round-02-factory-dropdown.png' })

// ③ 选测试库
const wanted = opts.find((t) => t.includes('测试'))
if (!wanted) throw new Error('下拉里没有测试库选项: ' + JSON.stringify(opts))
await page.click(`text=${wanted}`)
await page.waitForTimeout(800)
const afterSel = await page.evaluate(() => [...document.querySelectorAll('.el-select')]
  .map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t.startsWith('YINJIA-MES')))
console.log('factory after select:', JSON.stringify(afterSel))

// ④ 填账号密码登录
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.screenshot({ path: OUT + '/round-02-login-filled.png' })
await page.click('button:has-text("进入系统")')
await page.waitForTimeout(5000)
await restoreWindow()

const c = await claims()
const state = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}))
console.log('after login:', JSON.stringify({ claims: c, state }, null, 2))
await page.screenshot({ path: OUT + '/round-02-after-login.png' })
if (!c || c.factory !== 'YJ_TEST') throw new Error('登录账套不是 YJ_TEST: ' + JSON.stringify(c))
console.log('ROUND02_DONE  factory=YJ_TEST  user=' + c.sub)
