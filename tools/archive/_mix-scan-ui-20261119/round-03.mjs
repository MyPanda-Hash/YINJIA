// 探针:ego 会话里的登录态 / token 存放,便于用同一会话取一张真实工单
const task = await taskSpace('mix-scan-ui-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(3000)
const out = await page.evaluate(async () => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    const v = localStorage.getItem(k) || ''
    ls[k] = v.length > 90 ? v.slice(0, 40) + '…(' + v.length + ')' : v
  }
  const ss = {}
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const k = sessionStorage.key(i)
    ss[k] = (sessionStorage.getItem(k) || '').slice(0, 40)
  }
  const tokenKey = Object.keys(ls).find((k) => /token/i.test(k))
  const token = tokenKey ? (localStorage.getItem(tokenKey) || '') : ''
  const probe = async (url, headers) => {
    try {
      const r = await fetch(url, { headers })
      return { url, status: r.status, body: (await r.text()).slice(0, 120) }
    } catch (e) { return { url, err: String(e && e.message) } }
  }
  const h = {}
  if (token) h.Authorization = 'Bearer ' + (token.replace(/^"|"$/g, ''))
  const res = []
  res.push(await probe('/api/px/pick/create/woStatus?keyword=', h))
  res.push(await probe('/api/px/mix/lines?orderNo=GD-NONE', h))
  return { ls, ss, tokenPresent: !!token, tokenKey, res }
})
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: 'all' })
