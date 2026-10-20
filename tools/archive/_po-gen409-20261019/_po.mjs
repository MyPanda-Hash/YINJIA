/**
 * _po.mjs — 采购订单生单 409 取证(只读):列出最近采购订单 + 各自的「分批送料行状态」。
 * 用法: node tools/archive/_po-gen409-20261019/_po.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'

const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {}),
})).json())

const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 200)); process.exit(1) }
const token = lg.data.token

const q = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 10 }, token)
const rows = (q.data?.list) || []
console.log(`PU_ORDER: totalSize=${q.data?.totalSize} 取到 ${rows.length} 张`)
for (const r of rows) {
  const no = r['单据编号'] || r['编号']
  const st = r['单据状态'] || '-'
  console.log(`\n== ${no} 状态=${st} 供应商=${r['供应商'] || '-'} 日期=${r['单据日期'] || '-'}`)
  const b = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }, token)
  if (b.code !== 200) { console.log('   batchFlow/lines ->', JSON.stringify(b).slice(0, 300)); continue }
  const d = b.data || {}
  console.log('   nextBatchNo=', d.nextBatchNo, ' batches=', JSON.stringify(d.batches || d.已打印批次 || d.batchList || []).slice(0, 120))
  const lines = d.lines || d.rows || []
  console.log('   行数=', lines.length)
  for (const l of lines.slice(0, 6)) console.log('    ', JSON.stringify(l).slice(0, 260))
}
