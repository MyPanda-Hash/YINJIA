// round-04:探测当前页面状态(#/login 到底渲染了什么),再决定怎么登录
const task = await taskSpace('saleout-shipnote-20261128')
const page = task.page('p1')
const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)
const st = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    inputs: [...document.querySelectorAll('input,textarea')].map((i) => ({ ph: i.placeholder, type: i.type, cls: i.className })),
    selects: [...document.querySelectorAll('.el-select')].map(txt),
    buttons: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 12),
    bodyStart: txt(document.body).slice(0, 300),
    loggedFactory: localStorage.getItem('mes_factory'),
  }
})
log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/saleout-shipnote-20261128/round-04-login-state.png' })
