const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const probe = await page.evaluate(async () => {
  const t = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/portal/messages?limit=5', { headers: { Authorization: 'Bearer ' + t } })
  const body = await r.text()
  return { status: r.status, body: body.slice(0, 600) }
})
console.log(JSON.stringify(probe, null, 2))
