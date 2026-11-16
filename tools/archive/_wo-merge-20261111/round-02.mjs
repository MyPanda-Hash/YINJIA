// round-02:确认当前登录账套 + 打开「订单结转」页并 dump 待结转行
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(async () => {
  const ls = {}
  for (const k of Object.keys(localStorage)) if (k.length < 40) ls[k] = String(localStorage.getItem(k)).slice(0, 120)
  let me = null
  try { const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || localStorage.getItem('access_token') || '') } }); me = r.status } catch (e) { me = 'err ' + e.message }
  return {
    hash: location.hash,
    bodyText: (document.body.innerText || '').slice(0, 600),
    ls,
    meStatus: me,
    tableRows: [...document.querySelectorAll('.el-table__body tr')].slice(0, 25).map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).join(' | ')),
  }
})
console.log(JSON.stringify(info, null, 2).slice(0, 8000))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-02-orderconvert.png', fullPage: false })
