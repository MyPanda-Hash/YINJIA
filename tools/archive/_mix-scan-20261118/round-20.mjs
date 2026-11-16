// round-20.mjs — 配一台"验收用"打印站点(只勾混料单)→ 入队 → 证明服务端把「纸面」存进了打印缓存
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const station = 'VERIFY-MIX-20261118'
  const cfg = await post('/api/px/print/station', { stationName: station, enabled: true, types: ['MIX_SLIP'], paper: 'A4' })
  // 让站点"上线":打一次心跳(page 源即可)
  const hb = await fetch('/api/px/print/pending?station=' + encodeURIComponent(station) + '&source=page', { headers: H })
    .then((r) => r.json()).catch((e) => ({ err: String(e) }))
  const enq = await post('/api/px/print/enqueue', {
    类型: 'MIX_SLIP',
    标题: '成型配料记录',
    领料单号: 'PL2611160002',
    打印日期: '2026-11-18',
    纸面: { 标题: '成型配料记录', 文件编码: 'YJ-QR-147', 车间: '成型1线', 产品编号: 'A-45-01', 配料批次号: 'PL2611160002', 配料人: 'admin' },
    明细: [{ 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS(80-200)', 添加比例: '80.37%', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001' }],
    来源: 'verify.round20',
  })
  return { cfg: cfg.body?.data ?? cfg.body, heartbeat: !!hb, enq: enq.body?.data ?? enq.body }
})
console.log(JSON.stringify(out, null, 2))
