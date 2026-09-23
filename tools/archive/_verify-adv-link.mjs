// 验证:① 高级筛选服务端化(算子) ② 台账联动选项=档案∩有流水
// 用法: node tools/archive/_verify-adv-link.mjs
const BASE = 'http://localhost:8090/api'
let token = ''

async function api(path, body, method = 'POST') {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || (j.code !== undefined && j.code !== 0 && j.code !== 200)) {
    throw new Error(`${path} HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`)
  }
  return j.data ?? j
}

async function q(panelCode, extra = {}) {
  return api('/px/queryFormDataList', { panelCode, condition: {}, pageNo: 1, pageSize: 500, ...extra })
}

const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')) || 0)
const blank = (v) => v === undefined || v === null || String(v).trim() === ''

let fail = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) fail++
}

token = (await api('/auth/login', { userName: 'admin', password: '123456' })).token

// ── ① 高级筛选服务端化 ───────────────────────────────────────────────
console.log('\n== ① 高级筛选服务端化(报表)==')
const sum0 = await q('STOCK_SUMMARY')
console.log(`STOCK_SUMMARY 基线 totalSize=${sum0.totalSize}`)

// contains:期次 含 '2026'
const sumC = await q('STOCK_SUMMARY', { advFilters: [{ field: '期次', op: 'contains', value: '2026' }] })
const allC = sumC.list.every((r) => String(r['期次'] ?? '').includes('2026'))
check('contains 期次~2026:totalSize 变小且行行命中', sumC.totalSize < sum0.totalSize && allC && sumC.list.length === sumC.totalSize,
  `${sum0.totalSize} → ${sumC.totalSize}`)
const sumC2 = await q('STOCK_SUMMARY', { advFilters: [{ field: '期次', op: 'contains', value: '2026' }], pageNo: 1, pageSize: 2 })
check('contains 分页第 1 页(2 行)totalSize 与全量一致', sumC2.totalSize === sumC.totalSize && sumC2.list.length === 2,
  `totalSize=${sumC2.totalSize} 本页=${sumC2.list.length}`)

// empty / notEmpty:批号(只有台账有该列)
const lg0 = await q('STOCK_LEDGER', { pageSize: 500 })
const lgE = await q('STOCK_LEDGER', { advFilters: [{ field: '批号', op: 'empty' }], pageSize: 500 })
const lgN = await q('STOCK_LEDGER', { advFilters: [{ field: '批号', op: 'notEmpty' }], pageSize: 500 })
check('台账 empty 批号:全为空', lgE.list.every((r) => blank(r['批号'])), `totalSize=${lgE.totalSize}`)
check('台账 notEmpty 批号:全非空,且 空+非空=基线', lgN.list.every((r) => !blank(r['批号'])) && lgE.totalSize + lgN.totalSize === lg0.totalSize,
  `${lgE.totalSize} + ${lgN.totalSize} = ${lg0.totalSize}`)

// gt(数值):台账 收入数量 > 100
const lgG = await q('STOCK_LEDGER', { advFilters: [{ field: '收入数量', op: 'gt', value: '100' }], pageSize: 500 })
check('台账 gt 收入数量>100:数值比较生效', lgG.list.length > 0 && lgG.list.every((r) => num(r['收入数量']) > 100),
  `totalSize=${lgG.totalSize} 最小=${Math.min(...lgG.list.map((r) => num(r['收入数量'])))}`)
const lgG2 = await q('STOCK_LEDGER', { advFilters: [{ field: '收入数量', op: 'gt', value: '100' }], pageNo: 2, pageSize: 2 })
check('台账 gt 分页第 2 页 totalSize 与全量一致', lgG2.totalSize === lgG.totalSize, `totalSize=${lgG2.totalSize}`)

// eq / ne(字符串)
const sumNE = await q('STOCK_SUMMARY', { advFilters: [{ field: '存货', op: 'ne', value: '端盖' }] })
check('ne 存货<>端盖:无一行为端盖', sumNE.list.every((r) => String(r['存货'] ?? '').trim() !== '端盖'),
  `totalSize=${sumNE.totalSize}`)
const firstItem = String(lgN.list[0]?.['存货'] ?? '')
if (firstItem) {
  const sumEQ = await q('STOCK_SUMMARY', { advFilters: [{ field: '存货', op: 'eq', value: firstItem }] })
  check(`eq 存货='${firstItem}':只该存货`, sumEQ.list.length > 0 && sumEQ.list.every((r) => String(r['存货'] ?? '').trim() === firstItem),
    `totalSize=${sumEQ.totalSize}`)
}

// 多行 AND + 与 keyword 叠加(字段名按各面板真实列:台账 期次 不存在 → 用 单据日期)
const sumM = await q('STOCK_LEDGER', {
  keyword: '端盖',
  advFilters: [{ field: '批号', op: 'notEmpty' }, { field: '收入数量', op: 'ge', value: '1' }],
  pageSize: 500,
})
check('多行 AND 且与 keyword 叠加:命中行满足全部', sumM.list.length > 0 && sumM.list.every((r) => !blank(r['批号']) && num(r['收入数量']) >= 1),
  `totalSize=${sumM.totalSize}`)

// 脏输入:未知字段/未知算子/空值行 → 不报错且不过滤
const sumDirty = await q('STOCK_SUMMARY', {
  advFilters: [{ field: '不存在的字段', op: 'contains', value: 'x' }, { field: '期次', op: '瞎写的算子', value: 'y' }, { field: '批号', op: 'contains', value: '' }],
})
check('未知字段/未知算子/未填值:整批忽略,计数回到基线', sumDirty.totalSize === sum0.totalSize, `totalSize=${sumDirty.totalSize}`)

// 台账:期初/期末合成行不受 advFilters 影响(仍按 仓库+存货+日期段另算)
const lg = await q('STOCK_LEDGER', {
  condition: { 仓库: '华北工控仓', 存货: '端盖', 开始日期: '2020-01-01', 结束日期: '2030-12-31' },
  pageSize: 100,
})
const types = lg.list.map((r) => r['单据类型'])
check('台账三段式完好:首行期初结存 + 末行期末结存', types[0] === '期初结存' && types[types.length - 1] === '期末结存',
  `totalSize=${lg.totalSize} 首=${types[0]} 末=${types[types.length - 1]}`)
const lgDetail = lg.list.filter((r) => r['单据类型'] !== '期初结存' && r['单据类型'] !== '期末结存')
const lgAdv = await q('STOCK_LEDGER', {
  condition: { 仓库: '华北工控仓', 存货: '端盖', 开始日期: '2020-01-01', 结束日期: '2030-12-31' },
  advFilters: [{ field: '单据日期', op: 'gt', value: '2030-01-01' }],
  pageSize: 100,
})
check('台账+高级筛选(未来日期):明细清空但期初/期末行仍在(T+ 口径)',
  lgAdv.list.filter((r) => !['期初结存', '期末结存'].includes(r['单据类型'])).length === 0
  && lgAdv.list.some((r) => r['单据类型'] === '期初结存') && lgAdv.list.some((r) => r['单据类型'] === '期末结存'),
  `totalSize=${lgAdv.totalSize} 明细=${lgDetail.length}→${lgAdv.list.length - 2}`)

// ── ② 台账联动选项 = 档案 ∩ 有流水 ───────────────────────────────────
console.log('\n== ② 台账联动选项(档案∩有流水)==')
for (const panel of ['STOCK_LEDGER', 'STOCK_BALANCE']) {
  const all = await api('/px/callButton', { panelCode: panel, buttonName: '台账联动选项', formData: {}, buttonParam: {} })
  check(`${panel} 空条件:仓库仅档案内有流水的`, JSON.stringify(all['仓库列表']) === JSON.stringify(['恒亿仓', '华北工控仓']),
    `仓库=${JSON.stringify(all['仓库列表'])} 存货=${JSON.stringify(all['存货列表'])}`)
  const byItem = await api('/px/callButton', { panelCode: panel, buttonName: '台账联动选项', formData: { 存货: '端盖' }, buttonParam: {} })
  check(`${panel} 选存货=端盖:仓库收缩到有流水的`, JSON.stringify(byItem['仓库列表']) === JSON.stringify(['恒亿仓', '华北工控仓']),
    `仓库=${JSON.stringify(byItem['仓库列表'])}`)
  const byWh = await api('/px/callButton', { panelCode: panel, buttonName: '台账联动选项', formData: { 仓库: '华北工控仓' }, buttonParam: {} })
  check(`${panel} 选仓库=华北工控仓:存货收缩到有流水的 2 个`,
    JSON.stringify([...byWh['存货列表']].sort()) === JSON.stringify(['白色无纺布130g', '端盖'].sort()),
    `存货=${JSON.stringify(byWh['存货列表'])}`)
  const dead = await api('/px/callButton', { panelCode: panel, buttonName: '台账联动选项', formData: { 存货: '档案里没有的存货' }, buttonParam: {} })
  check(`${panel} 未建档/无流水存货:仓库列表为空(前端据此全灰+提示)`, dead['仓库列表'].length === 0,
    `仓库=${JSON.stringify(dead['仓库列表'])}`)
}

console.log(`\n${fail === 0 ? '全部通过' : fail + ' 项未通过'}`)
process.exit(fail === 0 ? 0 : 1)
