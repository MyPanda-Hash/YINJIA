// round-04b — 先查清 fetch 失败原因:当前页面地址、apiBase、直连 127.0.0.1:8090 的探针
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
const info = await page.evaluate(async () => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    ls[k] = String(localStorage.getItem(k)).slice(0, 80)
  }
  const probe = async (url) => {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      return { url, status: r.status, snippet: (await r.text()).slice(0, 200) }
    } catch (e) { return { url, error: String(e) } }
  }
  return {
    href: location.href,
    origin: location.origin,
    fetchType: typeof fetch,
    ls,
    probes: [await probe('/api/px/scheduleBoard/pending'), await probe('http://127.0.0.1:8090/api/px/scheduleBoard/pending')],
  }
})
console.log(JSON.stringify(info, null, 2))
