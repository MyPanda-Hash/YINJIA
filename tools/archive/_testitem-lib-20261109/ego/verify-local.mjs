// 本机「加标水 · 测试项目」下拉复验:补完 4 条历史条目后应为 5 项(与服务器一致)
const task = await taskSpace('testitem-lib-20261109')
const page = task.page('p1')
const base = 'http://127.0.0.1:8090'

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

await page.goto(base + '/#/login', { timeout: 40000 })
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
})
await page.goto(base + '/#/panelx/list/RD_SPIKE_WATER', { timeout: 40000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(10000)
await page.click('css:.rsp-sheet .el-select', { timeout: 8000 })
await page.waitForTimeout(1500)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
console.log('LOCAL opts(' + opts.length + ')=' + JSON.stringify(opts))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/testitem-lib-20261109/local-dropdown-after.png' })
// 选「NSF 42-余氯」看它是未设计(退回内置列集)
const i = opts.findIndex((t) => t.includes('NSF 42-余氯'))
if (i >= 0) {
  await page.click(`css:.el-select-dropdown__item >> nth=${i}`)
  await page.waitForTimeout(2500)
  const heads = await page.evaluate(() => [...document.querySelectorAll('.rsp-sheet table th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 24))
  console.log('NSF 42-余氯 表头=' + JSON.stringify(heads))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/testitem-lib-20261109/local-nsf42.png' })
}
