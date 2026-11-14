const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const probe = await page.evaluate(() => {
  const t = localStorage.getItem('mes_token') || ''
  const parts = t.split('.')
  let payload = null
  try { payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch (e) { payload = String(e) }
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}')
  return { payload, mesUser: { userName: u.userName, realName: u.realName, roles: u.roles } }
})
console.log(JSON.stringify(probe, null, 2))
