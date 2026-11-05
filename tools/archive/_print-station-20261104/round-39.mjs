// round-39: 复核 —— 清单现在 = 在跑的 ∪ 库里登记的(新登记的那台以"从没连过"留在清单里)
const task = await taskSpace(1)
const page = task.page('p1')
await page.reload()
await page.waitForTimeout(2500)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    api: (j?.data?.stations || []).map((s) => ({ name: s.name, online: s.online, enabled: s.enabled, types: s.types, ip: s.ip, lastSeen: s.lastSeen })),
    uiRows: q('.ps-station'),
    uiMeta: q('.ps-station-meta'),
  }
}), null, 2))
