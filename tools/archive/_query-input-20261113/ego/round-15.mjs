// round-15:用 CDP Network 事件抓文档加载阶段的 4xx/5xx 请求(定位「页面脚本异常」横幅来源)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.cdp('Network.enable')
await page.events()
await page.reload({ timeout: 90000 })
await page.waitForTimeout(9000)
const evs = await page.events()
const list = Array.isArray(evs) ? evs : (evs && evs.events) || []
const bad = []
for (const e of list) {
  const m = e.method || e.type || ''
  if (String(m).includes('response')) {
    const p = e.params || e
    const r = p.response || {}
    if (r.status >= 400) bad.push({ url: String(r.url || '').slice(0, 200), status: r.status })
  }
}
console.log('EVENTS ' + list.length)
console.log('BAD ' + JSON.stringify(bad, null, 2))
const st = await page.evaluate(() => ({
  banner: (document.body.innerText || '').match(/页面脚本异常[^\n]*/)?.[0] || '',
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
}))
console.log('STATE ' + JSON.stringify(st))
console.log('DONE round-15')
