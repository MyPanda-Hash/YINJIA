// round-01:登录本地 5173,登录工厂切到「测试库」,确认新菜单/页面存在
const task = await taskSpace('local-migrate-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(5000)

// 1) 切登录工厂到测试库(若页面上有该下拉)
const factoryInfo = await page.evaluate(() => {
  const txt = (document.body.innerText || '')
  return {
    loginPage: txt.includes('进入系统'),
    hasFactory: txt.includes('登录工厂') || txt.includes('工厂'),
    labels: [...document.querySelectorAll('.el-select__placeholder, .el-select__selected-item')].map((n) => (n.textContent || '').trim()).filter(Boolean).slice(0, 4),
  }
})
console.log('登录页:', JSON.stringify(factoryInfo))

// 点开下拉,选「测试库」
await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  if (sel) { const inp = sel.querySelector('input, .el-select__wrapper') || sel; inp.click(); }
})
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((n) => (n.textContent || '').trim()))
console.log('工厂选项:', JSON.stringify(opts))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((n) => /测试/.test(n.textContent || ''))
  if (it) it.click()
})
await page.waitForTimeout(700)

// 2) 填账号密码并登录
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const user = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pass = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (user) setVal(user, 'admin')
  if (pass) setVal(pass, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(8000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const txt = document.body.innerText || ''
  return {
    hash: location.hash,
    loggedIn: !txt.includes('进入系统'),
    dbBadge: (txt.match(/YINJIA-MES[^\n]{0,12}/g) || []).slice(0, 3),
    hasMixScan: txt.includes('扫码混料'),
    hasMobileReturn: txt.includes('生产退料'),
    hasSaleIn: txt.includes('销售退货单'),
    hasMaterialRet: txt.includes('生产退料单'),
    hasProdPickList: txt.includes('生产领料明细表'),
    hasProdRetList: txt.includes('生产退料明细表'),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/local-migrate-20261117/round-01-login-menu.png' })
