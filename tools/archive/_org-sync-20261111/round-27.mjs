const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const probe = await page.evaluate(async () => {
  const keys = Object.keys(localStorage)
  const tokenKeys = keys.filter((k) => /token|auth|jwt/i.test(k))
  const tokens = {}
  for (const k of tokenKeys) tokens[k] = String(localStorage.getItem(k) || '').slice(0, 24)
  let me = null
  try {
    const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('mes_token') || '') } })
    me = { status: r.status, body: (await r.text()).slice(0, 200) }
  } catch (e) { me = String(e) }
  let me2 = null
  try {
    const r2 = await fetch('/api/portal/badge')
    me2 = { status: r2.status, body: (await r2.text()).slice(0, 160) }
  } catch (e) { me2 = String(e) }
  return { keys, tokenKeys, tokens, me, me2 }
})
console.log(JSON.stringify(probe, null, 2))
