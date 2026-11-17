const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
const hits = []
page.on?.('response', (r) => {})
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
})
await page.reload(); await page.waitForTimeout(9000)
// 钩住 fetch，记录所有 /api 请求与响应体片段
await page.evaluate(() => {
  window.__log = []
  const of = window.fetch
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
    const res = await of(...args)
    try {
      if (url && url.includes('/api/')) {
        const clone = res.clone()
        const txt = await clone.text()
        window.__log.push({ url, body: txt.slice(0, 600) })
      }
    } catch (e) {}
    return res
  }
})
await page.evaluate(() => { location.hash = '#/panelx/list/RD_APPROVAL' })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find(x => (x.innerText || '').trim() === '新增')
  b?.click()
})
await page.waitForTimeout(6000)
await page.evaluate(() => { window.__log = [] })
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.as-row')].find(r => (r.innerText || '').includes('客户名'))
  row?.querySelector('.as-ref-ctl')?.click()
})
await page.waitForTimeout(5000)
const log = await page.evaluate(() => (window.__log || []).map(x => ({ url: x.url, len: x.body.length, head: x.body.slice(0, 260) })))
console.log('参照相关请求:')
for (const h of log.slice(0, 6)) console.log('  ', h.url, '|', h.head.replace(/\s+/g, ' ').slice(0, 220))
await task.finish({ keep: [] })
process.exit(0)
