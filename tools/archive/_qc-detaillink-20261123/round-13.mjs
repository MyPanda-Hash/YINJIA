// round-13.mjs —— 清会话 → 登录页 → 选「登录工厂 = YJ(正式库)」登录 → 正式账套复核点单号跳转
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(4000)
const loginDom = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', type: i.type })),
  selects: [...document.querySelectorAll('.el-select__placeholder, .el-select__selected-item')].map((e) => (e.innerText || '').trim()).filter(Boolean),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('LOGIN_DOM ' + JSON.stringify(loginDom, null, 2))
await task.finish({ keep: [] })
