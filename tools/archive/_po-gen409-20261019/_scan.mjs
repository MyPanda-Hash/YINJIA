/**
 * _scan.mjs — 全量扫描采购订单「生成送料暂收单」可送状态(只读)。
 * 输出:可生单(已审核且剩余>0)清单 + 已送满/非已审核统计。
 * 用法: node tools/archive/_po-gen409-20261019/_scan.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {}),
})).json())

const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
const token = lg.data.token

const q = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 500 }, token)
const rows = q.data?.list || []
console.log(`PU_ORDER totalSize=${q.data?.totalSize} 本次扫描 ${rows.length} 张`)

const ok = [], full = [], notApproved = []
for (const r of rows) {
  const no = r['单据编号'] || r['编号']
  const st = r['单据状态'] || '-'
  if (!no) continue
  if (st !== '已审核') { notApproved.push([no, st]); continue }
  const b = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }, token)
  if (b.code !== 200) { notApproved.push([no, st + '/lines:' + b.code]); continue }
  const lines = b.data?.lines || []
  const remain = lines.reduce((s, l) => s + Number(l['剩余数量'] || 0), 0)
  if (remain > 0.000001) ok.push([no, st, remain, lines.length])
  else full.push([no, st])
}

console.log(`\n可生单(已审核 + 剩余>0): ${ok.length}`)
for (const [no, st, remain, n] of ok.slice(0, 20)) console.log(`  ${no}  状态=${st}  剩余=${remain}  行=${n}`)
console.log(`已送满(已审核 + 剩余=0): ${full.length}`)
for (const [no, st] of full.slice(0, 10)) console.log(`  ${no}  状态=${st}`)
console.log(`非已审核: ${notApproved.length}`)
for (const [no, st] of notApproved.slice(0, 10)) console.log(`  ${no}  状态=${st}`)
