// round-04:用 YJ_TEST(测试库)登录 → 订单结转页 → 跳到最近有数据的一天 → dump 待结转行
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
const login = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const body = await r.json()
  const d = body && body.data ? body.data : body
  window.__loginRaw = { status: r.status, code: body && body.code, keys: d ? Object.keys(d) : null }
  if (d && d.token) {
    localStorage.setItem('mes_token', d.token)
    localStorage.setItem('mes_user', JSON.stringify(d.user || {}))
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  }
  return { status: r.status, code: body && body.code, userFactory: d && d.user ? d.user.factory : null, hasToken: !!(d && d.token) }
})
console.log('login:', JSON.stringify(login))
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(6000)
// 跳到最近有数据的一天(弹窗按钮)
const jumped = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box button, .el-dialog button')]
  const b = btns.find((x) => (x.innerText || '').includes('跳转'))
  if (b) { b.click(); return (b.innerText || '').trim() }
  return null
})
console.log('jumped:', jumped)
await page.waitForTimeout(6000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  factoryText: (document.querySelector('.t-topbar') || document.body).innerText.slice(0, 200).replace(/\n+/g, ' | '),
  summary: [...document.querySelectorAll('.oc-sum, .oc-summary, .ov-sum')].map((e) => e.innerText.replace(/\s+/g, ' ')).slice(0, 4),
  dateRange: [...document.querySelectorAll('input.el-range-input')].map((i) => i.value),
  rows: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())),
}))
console.log(JSON.stringify(info, null, 2).slice(0, 12000))
