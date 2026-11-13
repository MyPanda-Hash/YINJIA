// round-12 — 收尾:把浏览器登录态切回**正式账套**(用户在用的那套),停在快速排产页,弹窗关闭
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?t=' + Date.now(), { timeout: 30000 })
await page.waitForTimeout(2000)
const out = await page.evaluate(async () => {
  localStorage.removeItem('mes_token')
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json().catch(() => ({}))
  const token = j?.data?.token || j?.token || null
  if (token) localStorage.setItem('mes_token', token)
  return { status: r.status, tokenSet: !!token, msg: j?.message || null }
})
console.log('login=' + JSON.stringify(out))
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
await page.keyboard.press('Escape').catch(() => {})
const state = await page.evaluate(() => ({
  hash: location.hash,
  topbar: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
  openDialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length,
}))
console.log('state=' + JSON.stringify(state))
