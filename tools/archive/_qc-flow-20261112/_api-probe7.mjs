// _api-probe7.mjs — 第二轮(不合格分支 + 已转ERP 隐藏)接口核对
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const factory = process.argv[3] || ''
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(factory ? { factory } : {}) }),
}).then((r) => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const call = async (b) => {
  const j = await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())
  if (j.code !== 200) throw new Error(JSON.stringify(j).slice(0, 400))
  return j.data
}

for (const withHidden of [false, true]) {
  const d = await call({ 状态: '全部', 含已隐藏: withHidden, limit: 800 })
  const rows = d['行']
  const stage = {}
  for (const r of rows) stage[r['当前环节']] = (stage[r['当前环节']] || 0) + 1
  const withRet = rows.filter((r) => r['退货单号']).length
  const withTc = rows.filter((r) => r['特采单号']).length
  const hidden = rows.filter((r) => Number(r['已隐藏'] || 0) === 1).length
  console.log(`含已隐藏=${withHidden} 汇总=${JSON.stringify(d['汇总'])}`)
  console.log(`  环节分布=${JSON.stringify(stage)} 有退货单=${withRet} 有特采单=${withTc} 行内已隐藏=${hidden}`)
}

const d = await call({ 状态: '全部', 含已隐藏: true, limit: 800 })
console.log('\n---- 有退货单/特采单的样例 ----')
for (const r of d['行'].filter((x) => x['退货单号'] || x['特采单号']).slice(0, 6)) {
  console.log([r['送料暂收单号'], r['物料编码'], r['物料批号'], '| 检验', r['检验单号'] || '-', r['检验状态'] || '-', r['检验结论'] || '-',
    '| 退货', r['退货单号'] || '-', r['退货状态'] || '-', r['退货数量'] ?? '',
    '| 特采', r['特采单号'] || '-', r['特采状态'] || '-',
    '| 入库', r['入库单号'] || '-', r['入库状态'] || '-', r['入库已转ERP'] || '',
    '| 环节', r['当前环节'], '隐藏=' + r['已隐藏']].join(' '))
}
console.log('\n---- 已隐藏样例 ----')
for (const r of d['行'].filter((x) => Number(x['已隐藏'] || 0) === 1).slice(0, 4)) {
  console.log([r['送料暂收单号'], r['物料编码'], '入库', r['入库单号'] || '-', r['入库状态'] || '-', '转ERP=' + (r['入库已转ERP'] || '-'), 'ERP单号=' + (r['入库ERP单号'] || '-')].join(' '))
}
