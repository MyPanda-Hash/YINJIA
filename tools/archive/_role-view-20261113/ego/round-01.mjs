// round-01.mjs —— 打开 8091 登录页,摸清登录表单结构(工厂下拉怎么选)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId)

await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.waitForTimeout(3500)

const info = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({
    ph: i.placeholder || '', type: i.type, val: i.value, cls: (i.className || '').slice(0, 40),
  })),
  selects: [...document.querySelectorAll('select')].map((s) => ({
    cls: (s.className || '').slice(0, 30),
    opts: [...s.options].map((o) => `${o.value}=${o.text}`),
  })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  factoryTexts: [...document.querySelectorAll('.el-select, .factory, [class*=factory]')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)).slice(0, 10),
}))

console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-01-login.png' })
