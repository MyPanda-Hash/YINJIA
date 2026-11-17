// round-09: 读回刚生成的暂收单(用 getFormDescriptor,单张),确认 仓库/仓位;再走 暂收→检验/入库。
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

const RECV = 'SL-2026-11-0001'
const PO = 'PO-2026-11-0001'

const recv = await get(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(RECV)}`)
const doc = recv.body?.data || {}
const items = doc?.detail?.items || []
console.log('RECV ' + recv.status + ' 行数=' + items.length + ' 仓库/仓位=' +
  JSON.stringify(items.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'], 仓位名称: it['仓位名称'] }))))

// 暂收 → 检验或入库
const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [RECV] })
console.log('L2 ' + l2.status + ' ' + JSON.stringify(l2.body).slice(0, 400))
const rr = l2.body?.data?.docs?.[0]?.lines || []
const picks = rr.filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
console.log('PICKS ' + JSON.stringify(picks))
let chain = []
if (picks.length) {
  const g2 = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: RECV, lines: picks }] })
  console.log('G2 ' + g2.status + ' ' + JSON.stringify(g2.body).slice(0, 500))
  const made = g2.body?.data?.['生成'] || []
  chain = made.flatMap((m) => (m['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] })))
  if (!chain.length && made[0]?.编号) chain = [{ 面板: made[0]['面板'] || 'QC_INSP', 编号: made[0]['编号'] }]
}
console.log('CHAIN ' + JSON.stringify(chain))
const lines = []
for (const c of chain) {
  const panel = c['面板'] === 'PURCHASE_IN' ? 'PURCHASE_IN' : 'QC_INSP'
  const d = await get(`/api/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(c['编号'])}`)
  const its = d.body?.data?.detail?.items || []
  for (const it of its) {
    lines.push({ 面板: panel, 编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'], 仓库: it['仓库'] || it['仓库代码'], 仓位: it['仓位'] })
  }
}
console.log('CHAIN_LINES ' + JSON.stringify(lines))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-09.json',
  JSON.stringify({ RECV, PO, recvItems: items.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] })), chain, lines }, null, 2), 'utf8')
