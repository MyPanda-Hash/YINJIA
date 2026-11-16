// round-19.mjs — 校验服务端把「纸面」原样存进打印缓存(混料单走专用纸表的最后一环)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      类型: 'MIX_SLIP',
      标题: '成型配料记录',
      领料单号: 'PL2611160002',
      打印日期: '2026-11-18',
      纸面: { 标题: '成型配料记录', 文件编码: 'YJ-QR-147', 车间: '成型1线', 产品编号: 'A-45-01', 配料批次号: 'PL2611160002', 配料人: 'admin' },
      明细: [{ 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS(80-200)', 添加比例: '80.37%', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001' }],
      来源: 'verify.round19',
    }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
})
console.log(JSON.stringify(res, null, 2))
