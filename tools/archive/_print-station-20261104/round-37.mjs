// round-37: 手机端真实路径 —— 单据「打印二维码」→ 站点派单 → 代理出纸(带单号/明细)
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?id=827', { timeout: 30000 })
await page.waitForTimeout(3500)
// 点底栏「打印二维码」
await page.click('loc=css:.mp-foot button:has-text("打印二维码")', { label: 'print qr from mobile page' })
await page.waitForTimeout(3000)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return { ok: q('.mp-ok'), err: q('.mp-err') }
}), null, 2))
await page.waitForTimeout(12000)
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return { queueSize: j?.data?.queueSize, recent: (j?.data?.recent || []).slice(0, 2).map((x) => ({ 时间: x.时间, 工单号: x.工单号, 类型: x.类型, 来源: x.来源 })) }
}), null, 2))
