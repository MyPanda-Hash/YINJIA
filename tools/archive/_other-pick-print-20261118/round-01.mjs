// round-01:验证「自动打印」页 —— 最近出纸是否显示单号/失败原因 + 打印缓存里能否看见失败单
// 目标地址:vite 源码版(5173)。登录工厂 = YJ_TEST(测试库,本机的打印站点配置在这个账套)
const task = await taskSpace('other-pick-print-20261118')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) {
    console.log('restore skip: ' + e.message)
  }
}

async function loginIfNeeded() {
  const url = await page.url()
  const needLogin = url.includes('/login') || !url.includes('/sys/printStation')
  if (!needLogin) return false
  console.log('on login page: ' + url)
  // 1) 账号 / 密码
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'admin')
    if (pwd) setVal(pwd, '123456')
  })
  await page.waitForTimeout(600)
  // 2) 登录工厂:必须选 YJ_TEST(测试库),否则看到的是正式账套的站点配置
  const picked = await page.evaluate(() => {
    const sel = document.querySelector('.el-select')
    if (!sel) return 'no-select'
    sel.querySelector('.el-select__wrapper, .el-input__wrapper, input')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    sel.click()
    return 'clicked'
  })
  await page.waitForTimeout(900)
  const clicked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((i) => (i.textContent || '').includes('测试'))
    if (target) { target.click(); return (target.textContent || '').trim() }
    return 'options=' + items.map((i) => (i.textContent || '').trim()).join('/')
  })
  console.log({ picked, clicked })
  await page.waitForTimeout(600)
  // 3) 进入系统
  const submitted = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /进入系统|登录/.test(b.textContent || ''))
    if (btn) { btn.click(); return (btn.textContent || '').trim() }
    return 'no-button'
  })
  console.log({ submitted })
  await page.waitForTimeout(4000)
  return true
}

await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 60000 })
await page.waitForTimeout(2500)
await loginIfNeeded()
const afterLogin = await page.url()
console.log('url after login: ' + afterLogin)
// 登录成功后重新进一次页面(确保路由已就绪)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 60000 })
await page.waitForTimeout(5000)
await restoreWindow()

const data = await page.evaluate(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    hasAuth: !!localStorage.getItem('yj_token') || document.body.innerText.includes('自动打印'),
    recent: [...document.querySelectorAll('.ps-recent')].map(txt),
    recentPlain: [...document.querySelectorAll('.ps-line')].map(txt),
    cache: [...document.querySelectorAll('.ps-cache')].map(txt),
    sections: [...document.querySelectorAll('.ps-sec')].map(txt),
    emptyText: [...document.querySelectorAll('.ps-empty')].map(txt),
  }
})
console.log(JSON.stringify(data, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/print-station.png', fullPage: true })
console.log('screenshot done')
