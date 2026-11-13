// round-22.mjs —— 诊断:为什么清掉 localStorage 还进不了登录页
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

const dump = async (tag) => {
  const s = await page.evaluate(() => ({
    hash: location.hash,
    href: location.href,
    inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
    lsKeys: Object.keys(localStorage),
    ssKeys: Object.keys(sessionStorage),
    hasLoginBtn: !!([...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))),
  }))
  console.log(tag + ' = ' + JSON.stringify(s))
}

await dump('初始')
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(2500)
await dump('goto login 后')

await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.cdp('Network.clearBrowserCookies', {})
await page.goto('http://127.0.0.1:8091/?r=' + Date.now() + '#/login', { timeout: 60000 })
await page.waitForTimeout(3000)
await dump('清空 + 重载后')

await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-22-login-state.png' })
