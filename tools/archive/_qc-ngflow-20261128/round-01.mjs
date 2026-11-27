const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page.waitForTimeout(3000)

// 登录(测试账套 YJ_TEST)
const loginState = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
  return { hash: location.hash, hasAcc: !!acc, hasPwd: !!pwd, body: document.body.innerText.slice(0, 300) }
})
console.log('LOGIN-FORM', JSON.stringify(loginState))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-01-login.png' })

// 选择登录工厂 = YJ_TEST(测试库),避免污染正式账
const pick = await page.evaluate(() => {
  const sel = document.querySelector('.el-select, .factory-select, [class*="factory"]')
  return sel ? sel.outerHTML.slice(0, 400) : 'no-select'
})
console.log('FACTORY-SELECT', pick)
