// round-16:诊断 —— 打印资源清单样本 + 主动 fetch 后再看 performance 是否记录
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(async () => {
  const before = performance.getEntriesByType('resource').map((r) => r.name)
  const tok = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
  const r = await fetch('/api/stdlib/list?lib=INSP_FREQ_OQC&all=1', { headers: { Authorization: 'Bearer ' + tok } })
  const body = await r.json()
  const after = performance.getEntriesByType('resource').map((e) => e.name)
  return {
    beforeCount: before.length,
    nonAsset: before.filter((n) => !n.includes('/assets/')).slice(0, 15),
    afterCount: after.length,
    newEntries: after.filter((n) => !before.includes(n)),
    fetchStatus: r.status,
    n: body && body.data ? body.data.length : null,
  }
}), null, 2))
