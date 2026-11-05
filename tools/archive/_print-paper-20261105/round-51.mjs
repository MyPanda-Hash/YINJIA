// round-51: 面板上复核「纸张」下拉(每台打印电脑一行)
const task = await taskSpace(1)
const page = task.page('p1')
await page.reload()
await page.waitForTimeout(2500)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  const row = document.querySelector('.ps-station')
  return {
    rowText: row ? (row.textContent || '').replace(/\s+/g, ' ').trim() : null,
    paperSelect: q('.ps-station .ps-paper'),
    paperValue: (() => {
      const el = document.querySelector('.ps-station .ps-paper')
      return el ? (el.querySelector('input') || {}).value : null
    })(),
    apiPaper: null,
  }
}), null, 2))
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return { stations: (j?.data?.stations || []).map((s) => ({ name: s.name, paper: s.paper, online: s.online, enabled: s.enabled })), localPaper: j?.data?.stationPaper }
}), null, 2))
