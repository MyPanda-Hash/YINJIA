// 只读诊断:确认面板查询接口在页面上下文里的可达性(不写数据)。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(3000)

const probe = await page.evaluate(async () => {
  const out = {}
  try {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelCode: 'PU_ORDER', keyword: 'YJ-20261027-05', pageNo: 1, pageSize: 5 }),
      credentials: 'include',
    })
    out.status = r.status
    out.ctype = r.headers.get('content-type')
    out.url = r.url
    const t = await r.text()
    out.len = t.length
    out.head = t.slice(0, 300)
  } catch (e) { out.err = String(e) }
  out.cookies = document.cookie ? document.cookie.slice(0, 200) : '(none visible)'
  out.ls = Object.keys(localStorage).slice(0, 20)
  out.ss = Object.keys(sessionStorage).slice(0, 20)
  return out
})
console.log(JSON.stringify(probe, null, 2))
