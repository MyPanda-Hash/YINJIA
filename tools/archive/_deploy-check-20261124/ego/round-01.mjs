// round-01: 打开生产登录页,先看现状(是否已登录 / 表单长什么样)
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)

const s = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type, val: i.value })),
  selects: [...document.querySelectorAll('.el-select, select')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8),
}))
console.log(JSON.stringify(s, null, 2))
