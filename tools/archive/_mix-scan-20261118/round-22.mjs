// round-22.mjs — 收尾:把验收用的打印站点关掉并删掉(别留在用户的「自动打印」页里)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const station = 'VERIFY-MIX-20261118'
  const off = await fetch('/api/px/print/station', {
    method: 'POST', headers: H,
    body: JSON.stringify({ stationName: station, enabled: false, types: [] }),
  }).then((r) => r.json()).catch((e) => ({ err: String(e) }))
  const del = await fetch('/api/px/print/station/delete', {
    method: 'POST', headers: H, body: JSON.stringify({ stationName: station }),
  }).then((r) => r.json()).catch((e) => ({ err: String(e) }))
  return {
    offEnabled: off?.data?.stationEnabled,
    del: del?.data ?? del,
  }
})
console.log(JSON.stringify(out, null, 2))
