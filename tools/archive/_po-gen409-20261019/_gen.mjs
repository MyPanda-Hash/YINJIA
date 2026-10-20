/**
 * _gen.mjs — 复现采购订单「生成送料暂收单」的 409：先只读查剩余量，只有全 0 才发 generate（必被守卫挡回，不写库）。
 * 用法: node tools/archive/_po-gen409-20261019/_gen.mjs <单据编号> [baseUrl]
 */
const NO = process.argv[2]
const BASE = (process.argv[3] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
if (!NO) { console.log('用法: node _gen.mjs <单据编号> [baseUrl]'); process.exit(1) }

const post = async (p, b, token) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(b || {}),
  })
  let body = null
  try { body = await r.json() } catch { body = await r.text() }
  return { status: r.status, body }
}

const lg = (await post('/auth/login', { userName: 'admin', password: '123456' })).body
if (lg?.code !== 200) { console.log('登录失败'); process.exit(1) }
const token = lg.data.token

const lines = (await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: NO }, token)).body
if (lines.code !== 200) { console.log('batchFlow/lines ->', JSON.stringify(lines).slice(0, 300)); process.exit(1) }

const rows = lines.data.lines || []
const remaining = rows.reduce((s, l) => s + Number(l['剩余数量'] || 0), 0)
console.log(`单据 ${NO}: 行数=${rows.length} 剩余合计=${remaining}`)
for (const l of rows) console.log(`  行${l['行号']} ${l['物料编码']} 订单=${l['订单数量']} 已送=${l['已送数量']} 剩余=${l['剩余数量']} 可送上限=${l['可送上限']}`)

if (remaining > 0) { console.log('\n⚠ 仍有剩余量，跳过 generate（避免真的生单写库）'); process.exit(0) }

const r = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: NO, lines: [] }, token)
console.log(`\nHTTP ${r.status}`)
console.log(JSON.stringify(r.body))
