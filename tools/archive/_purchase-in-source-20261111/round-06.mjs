import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(2500)

// 在页面上下文里用应用自己的登录态调接口(等价于界面点「生单」;测试账套,可弃)
const result = await page.evaluate(async () => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    ls[k] = (localStorage.getItem(k) || '').slice(0, 60)
  }
  const tokenKeys = Object.keys(ls).filter((k) => /token/i.test(k))
  let token = ''
  for (const k of tokenKeys) {
    try {
      const raw = localStorage.getItem(k)
      const v = JSON.parse(raw)
      if (typeof v === 'string') token = v
      else if (v && typeof v === 'object') token = v.token || v.accessToken || v.value || ''
    } catch { token = localStorage.getItem(k) || '' }
    if (token) break
  }
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token.replace(/^"|"$/g, '')
  const post = async (path, body) => {
    const r = await fetch('/api' + path, { method: 'POST', headers, body: JSON.stringify(body) })
    return await r.json()
  }
  const candidates = ['SL-2026-10-0121', 'SL-2026-10-0123', 'SL-2026-10-0124', 'SL-2026-10-0125',
    'SL-2026-10-0126', 'SL-2026-10-0127', 'SL-2026-10-0128', 'SL-2026-10-0132']
  const probes = []
  let chosen = null
  for (const no of candidates) {
    const res = await post('/px/batchFlow/lines', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: no })
    const d = res.data || {}
    const lines = d.lines || []
    const open = lines.filter((l) => Number(l['剩余数量']) > 0)
    probes.push({ no, code: res.code, msg: res.message, lines: lines.length, open: open.length })
    if (open.length && !chosen) chosen = { no, line: open[0] }
    if (chosen) break
  }
  return { tokenFound: tokenKeys, probes, chosen }
})
console.log('probe=' + JSON.stringify(result, null, 2))
await fs.writeFile(OUT + '/r06-probe.json', JSON.stringify(result, null, 2), 'utf8')

if (result.chosen) {
  const qty = Math.min(1, Number(result.chosen.line['剩余数量']))
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
    sourcePanel: 'QC_RECV',
    targetPanel: 'PURCHASE_IN',
    sourceNo: result.chosen.no,
    lines: [{ lineKey: result.chosen.line.lineKey, qty }],
  })
  console.log('gen=' + JSON.stringify(gen, null, 2))
  await fs.writeFile(OUT + '/r06-generate.json', JSON.stringify(gen, null, 2), 'utf8')
}
