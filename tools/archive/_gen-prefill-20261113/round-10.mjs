// round-10: 动态取 detail 键 → 审核暂收单 → 暂收 → 检验/入库 → 读回 仓库/仓位
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const get = async (path) => {
  const res = await page.fetch(path, { headers: { authorization: 'Bearer ' + token } })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (panelCode, buttonName, formData) => post('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} })
const detailItems = (doc) => {
  const det = doc?.detail && typeof doc.detail === 'object' ? doc.detail : {}
  for (const v of Object.values(det)) if (Array.isArray(v)) return v
  return []
}

const RECV = 'SL-2026-11-0001'
const recv = await get(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(RECV)}`)
const recvItems = detailItems(recv.body?.data)
console.log('RECV detailKeys=' + JSON.stringify(Object.keys(recv.body?.data?.detail || {})) +
  ' 行数=' + recvItems.length + ' 仓库/仓位=' + JSON.stringify(recvItems.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] }))))

// 暂收单审核(已审核才能继续生单)
const aud = await call('QC_RECV', '审核', { 编号: RECV })
console.log('AUDIT_RECV ' + aud.status + ' ' + JSON.stringify(aud.body?.data || aud.body).slice(0, 160))

const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [RECV] })
const rr = l2.body?.data?.docs?.[0]?.lines || []
const picks = rr.filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
console.log('PICKS ' + JSON.stringify(picks))
const out = { recvItems: recvItems.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] })), chain: [], lines: [] }
if (picks.length) {
  const g2 = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: RECV, lines: picks }] })
  console.log('G2 ' + g2.status + ' ' + JSON.stringify(g2.body?.data || g2.body).slice(0, 400))
  const made = g2.body?.data?.['生成'] || []
  out.chain = made.flatMap((m) => (m['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] })))
  if (!out.chain.length && made[0]?.['编号']) out.chain = [{ 面板: made[0]['面板'] || 'QC_INSP', 编号: made[0]['编号'] }]
}
for (const c of out.chain) {
  const panel = String(c['面板'] || 'QC_INSP')
  const d = await get(`/api/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(c['编号'])}`)
  const its = detailItems(d.body?.data)
  for (const it of its) {
    out.lines.push({ 面板: panel, 编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'], 仓库: it['仓库'] || it['仓库代码'], 仓位: it['仓位'] })
  }
}
console.log('CHAIN ' + JSON.stringify(out.chain))
console.log('CHAIN_LINES ' + JSON.stringify(out.lines))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-10.json', JSON.stringify(out, null, 2), 'utf8')
