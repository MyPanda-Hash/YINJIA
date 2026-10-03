/* 临时探针(任务产物,提交时归 tools/archive):验证 PURCHASE_IN getFormDescriptor 行键形态,
 * 供「打印标识卡」分支的字段假设取证。用法:node _probe-purchase-in-lines.cjs */
const BASE = 'http://127.0.0.1:8090/api'

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())
  const token = login?.data?.token
  if (!token) { console.error('login failed:', JSON.stringify(login).slice(0, 300)); process.exit(1) }

  const res = await fetch(`${BASE}/px/getFormDescriptor?panelCode=PURCHASE_IN&code=${encodeURIComponent('PI-2026-09-0012')}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  console.log('原始响应键 =', Object.keys(res), '| res.code =', res.code, '| message =', String(res.message).slice(0, 300), '| res.data 键 =', res.data && Object.keys(res.data))
  const doc = res?.data?.data || res?.data || {}
  const detailData = res?.data?.detailData || res?.detailData || {}
  const lines = Object.values(detailData)[0] || []
  console.log('头.单据编号 =', doc['单据编号'])
  console.log('头.供应商   =', doc['供应商'])
  console.log('头.采购订单号 =', doc['采购订单号'])
  console.log('行数 =', lines.length)
  const l = lines[0] || {}
  for (const k of ['存货编码', '存货名称', '规格型号', '实收数量', '计量单位', '批次号', '批号', '生产日期'])
    console.log(`  行[0].${k} =`, JSON.stringify(l[k]))
  const btn = await fetch(`${BASE}/px/getPanelConfig?panelCode=PURCHASE_IN`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  const groups = btn?.data?.metadata?.buttonGroups || []
  const printGroup = groups.find((g) => g.name === '打印')
  console.log('PURCHASE_IN 打印组动作 =', JSON.stringify(printGroup?.actions))

  const puBtn = await fetch(`${BASE}/px/getPanelConfig?panelCode=PU_ORDER`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  const puGroups = puBtn?.data?.metadata?.buttonGroups || []
  console.log('PU_ORDER 打印组动作 =', JSON.stringify(puGroups.find((g) => g.name === '打印')?.actions))

  const fd = await fetch(`${BASE}/px/getFormDescriptor?panelCode=PU_ORDER&code=${encodeURIComponent('YJ-20260915-05')}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  const puLines = Object.values(fd?.data?.detailData || {})[0] || []
  const pl = puLines[0] || {}
  console.log('PU_ORDER 行[0]: 物料编码 =', JSON.stringify(pl['物料编码']), '| 物料名称 =', JSON.stringify(pl['物料名称']), '| 数量 =', pl['数量'], '| 单位 =', JSON.stringify(pl['单位']))
}
main().catch((e) => { console.error(e); process.exit(1) })
