import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
const CAND = 'D:/YINJIA-main/tools/archive/_recv-candidates.json'
await fs.mkdir(OUT, { recursive: true })
const candidates = JSON.parse((await fs.readFile(CAND, 'utf8')).replace(/^\uFEFF/, ''))

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(2500)

const probe = await page.evaluate(async (list) => {
  const tokenKeys = Object.keys(localStorage).filter((k) => /token/i.test(k))
  let token = ''
  for (const k of tokenKeys) {
    try {
      const v = JSON.parse(localStorage.getItem(k))
      if (typeof v === 'string') token = v
      else if (v && typeof v === 'object') token = v.token || v.accessToken || v.value || ''
    } catch { token = localStorage.getItem(k) || '' }
    if (token) break
  }
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token.replace(/^"|"$/g, '')
  const hits = []
  let chosen = null
  for (const no of list) {
    const r = await fetch('/api/px/batchFlow/lines', { method: 'POST', headers,
      body: JSON.stringify({ sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: no }) })
    const res = await r.json()
    const lines = (res.data || {}).lines || []
    const open = lines.filter((l) => Number(l['剩余数量']) > 0)
    if (open.length) {
      hits.push({ no, open: open.length, first: open[0]['剩余数量'], lineKey: open[0].lineKey })
      if (!chosen) chosen = { no, line: open[0] }
    }
    if (chosen) break
  }
  return { token: tokenKeys, hits, chosen }
}, candidates)
console.log('probe=' + JSON.stringify(probe, null, 2))

if (probe.chosen) {
  const qty = Math.min(1, Number(probe.chosen.line['剩余数量']))
  const gen = await page.evaluate(async (payload) => {
    const tokenKeys = Object.keys(localStorage).filter((k) => /token/i.test(k))
    let token = ''
    for (const k of tokenKeys) {
      try {
        const v = JSON.parse(localStorage.getItem(k))
        if (typeof v === 'string') token = v
        else if (v && typeof v === 'object') token = v.token || v.accessToken || v.value || ''
      } catch { token = localStorage.getItem(k) || '' }
      if (token) break
    }
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = 'Bearer ' + token.replace(/^"|"$/g, '')
    const r = await fetch('/api/px/batchFlow/generate', { method: 'POST', headers, body: JSON.stringify(payload) })
    return await r.json()
  }, {
    sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: probe.chosen.no,
    lines: [{ lineKey: probe.chosen.line.lineKey, qty }],
  })
  console.log('gen=' + JSON.stringify(gen, null, 2))
  await fs.writeFile(OUT + '/r07-generate.json', JSON.stringify({ probe, gen }, null, 2), 'utf8')
}
await fs.writeFile(OUT + '/r07-probe.json', JSON.stringify(probe, null, 2), 'utf8')
