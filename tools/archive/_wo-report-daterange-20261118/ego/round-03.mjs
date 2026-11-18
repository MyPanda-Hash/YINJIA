const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
console.log('url', await page.url())
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const res = { origin: location.origin, hasToken: !!token, probe: null, err: null }
  try {
    const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    res.probe = { status: r.status, text: (await r.text()).slice(0, 200) }
  } catch (e) { res.err = String(e) }
  return res
})
console.log(JSON.stringify(out, null, 2))
