const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// 先退出当前会话(admin),看登录页结构
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(4000)
const out = await page.evaluate(() => {
  try { localStorage.removeItem('mes_token'); localStorage.removeItem('token'); } catch (e) {}
  return { hash: location.hash, keys: Object.keys(localStorage) }
})
console.log(JSON.stringify(out))
await page.evaluate(() => location.reload())
await page.waitForTimeout(5000)
const login = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    hash: location.hash,
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
    inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
    selects: [...document.querySelectorAll('.el-select')].map((s) => txt(s)),
    buttons: [...document.querySelectorAll('button')].map((b) => txt(b)).filter(Boolean).slice(0, 10),
  }
})
console.log(JSON.stringify(login, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-20-login.png' })
