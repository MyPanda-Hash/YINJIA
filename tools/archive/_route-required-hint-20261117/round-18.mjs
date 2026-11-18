const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
console.log(JSON.stringify(await page.evaluate(() => ({
  lsRoute: Object.keys(localStorage).filter((k) => /route|ROUTE|draft|fresh/i.test(k)),
  ssRoute: Object.keys(sessionStorage).filter((k) => /route|ROUTE|draft|fresh/i.test(k)),
})), null, 2))
// 用页面自己的 fetch 看看后端给这张单返回了什么(带 cookie/令牌)
console.log(JSON.stringify(await page.evaluate(async () => {
  const tok = localStorage.getItem('token') || localStorage.getItem('mes_token') || ''
  const url = '/api/panelx/detail?panelCode=ROUTE&code=' + encodeURIComponent('GY-2026-11-0002')
  try {
    const r = await fetch(url, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} })
    const t = await r.text()
    return { url, status: r.status, body: t.slice(0, 600) }
  } catch (e) { return { url, err: String(e) } }
}), null, 2))
