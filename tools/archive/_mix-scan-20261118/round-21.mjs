// round-21.mjs — 全链路:配站点 → 入队(带纸面)→ /pending 取回"代理会收到的那份任务 JSON"
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const station = 'VERIFY-MIX-20261118'
  await fetch('/api/px/print/station', {
    method: 'POST', headers: H,
    body: JSON.stringify({ stationName: station, enabled: true, types: ['MIX_SLIP'], paper: 'A4' }),
  })
  // 心跳(让站点上线),把之前残留的任务先取走丢掉
  await fetch('/api/px/print/pending?station=' + encodeURIComponent(station) + '&source=page', { headers: H })
  const enq = await fetch('/api/px/print/enqueue', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      类型: 'MIX_SLIP', 标题: '成型配料记录', 领料单号: 'PL2611160002', 打印日期: '2026-11-18',
      纸面: {
        标题: '成型配料记录', 文件编码: 'YJ-QR-147', 序号: 1, 车间: '成型1线', 产品编号: 'A-45-01',
        配方版本号: '', 开始时间: '2026-11-16 15:00', 结束时间: '2026-11-16 15:01', 转速: '',
        配料批次号: 'PL2611160002', 物料水分: '', 配料人: 'admin', 确认人: '',
      },
      明细: [
        { 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS(80-200)', 添加比例: '80.37%', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001' },
        { 物料编号: 'YJ-YKRS-005', 物料名: '英克瑞斯椰壳活性炭', 添加比例: '19.63%', 应投重量: '21.042', 实投重量: '21.042', 物料批次: '20261118002' },
      ],
      来源: 'verify.round21',
    }),
  }).then((r) => r.json())
  const pend = await fetch('/api/px/print/pending?station=' + encodeURIComponent(station) + '&source=page', { headers: H })
    .then((r) => r.json())
  return { enq: enq?.data, task: pend?.data?.task }
})
const fs = await import('node:fs/promises')
await fs.writeFile('C:/Users/Lenovo/ego/mix-scan-20261118/agent-task.json',
  JSON.stringify(out.task || {}, null, 2), 'utf8')
console.log(JSON.stringify({
  enq: out.enq && { queued: out.enq.queued, taskId: out.enq.taskId, station: out.enq.station },
  taskKeys: Object.keys(out.task || {}),
  hasSheet: !!(out.task && out.task['纸面']),
  paper: out.task && out.task['纸张'],
  sheet: out.task && out.task['纸面'],
  row0: out.task && (out.task['明细'] || [])[0],
}, null, 2))
