// round-12:直接打接口看 INSP_FREQ_OQC 是否返回条目(排除前端状态问题)
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(4000)
const out = await page.evaluate(async () => {
  const tok = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
  const call = async (url) => {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } })
    let body = null
    try { body = await r.json() } catch (e) { body = 'non-json' }
    return { status: r.status, body }
  }
  return {
    oqc: await call('/api/stdlib/list?lib=INSP_FREQ_OQC&all=1'),
    old: await call('/api/stdlib/list?lib=INSP_FREQ&all=1'),
  }
})
const slim = (x) => x.body && x.body.data ? { status: x.status, n: x.body.data.length, first: x.body.data.slice(0, 8).map((r) => r.content) } : x
console.log(JSON.stringify({ oqc: slim(out.oqc), old: slim(out.old) }, null, 2))
