/*
 * _verify-close-after-asm-insp.mjs — 结案正路径:组装成品检验审核 + 入库 → ja='Y'(2026-10-15)
 * 用户口径:「当最后组装成品检验完成入库后才显示结案」。
 * 链路:填组装成品检验数量判定 → 审核 → 自动生成产成品入库单草稿 → 审核入库 → 入库≥排产 ⇒ 结案。
 * 测试账套 YJ_TEST。用法: node tools/archive/_verify-close-after-asm-insp.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-09-0004'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())
const rows = async () => ((await api('/px/workOrderList', { keyword: WO })).data || []).filter((r) => String(r['工单号']) === WO)
const show = async (tag) => { const r = (await rows())[0]; console.log(`    [${tag}] 完工状态=${r['完工状态']} 入库=${r['入库数量']} 排产=${r['排产数量']} 生产状态=${r['生产状态']} 结案=${r['结案']}`); return r }

// 找该工单的组装成品检验单
const insp = (await api('/px/queryFormDataList', { panelCode: 'QC_ASM_INSP', pageNo: 1, pageSize: 200 })).data || {}
const irows = insp.rows || insp.list || insp.items || []
const mine = irows.filter((x) => String(x['工单号']) === WO && String(x['单据状态'] || '') !== '已作废')
console.log(`组装成品检验单 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 行: x['工单行号'], 状态: x['单据状态'] })))}`)
ok('① 找到组装成品检验单', mine.length > 0, `n=${mine.length}`)
if (!mine.length) { console.log(`\n[结果] pass=${pass} fail=${fail}`); process.exit(1) }
const no = mine[0]['单据编号']
// ⚠ 幂等:重复跑时该检验单可能**已经审核过**(上一轮留下的)⇒ 只在草稿/修改中时才去保存+审核,
//   已审核就当作"前置条件已满足"直接继续(原来不分情况硬审,重复跑必报「单据已是已审核状态」)
const alreadyAudited = String(mine[0]['单据状态'] || '') === '已审核'
// ⚠ 面板保存要求单头必填项齐备(实测只传 单据编号+明细 会报「工单号不能为空」)⇒ 把列表行里的单头字段带回去
const head = { ...mine[0] }
delete head['detail']

// 读它的明细,把「合格」行数量填成本行排产数量
const before = await show('审核前')
const plan = Number(before['排产数量'] || 0)
const det = (await api('/px/queryFormDataList', { panelCode: 'QC_ASM_INSP_DETAIL', pageNo: 1, pageSize: 50, docNo: no }).catch(() => ({}))).data || {}
void det
// 用面板保存接口按单据编号回写:数量判定两行(合格=plan, 不合格=0)
const items = [
  { 单据编号: no, 行号: 1, 表区: '数量判定', 检验项目: '成品检验', 判定: '合格', 数量: plan },
  { 单据编号: no, 行号: 2, 表区: '数量判定', 检验项目: '成品检验', 判定: '不合格', 数量: 0 },
]
const sv = alreadyAudited ? { code: 200, message: 'skip(已审核)' }
  : await api('/px/callButton', { panelCode: 'QC_ASM_INSP', buttonName: '保存', buttonParam: {}, formData: { ...head, 单据编号: no, detail: { items } } })
console.log(`    保存检验单 = ${JSON.stringify(sv).slice(0, 160)}`)
const au = alreadyAudited ? { code: 200, message: 'skip(已审核)' }
  : await api('/px/callButton', { panelCode: 'QC_ASM_INSP', buttonName: '审核', buttonParam: {}, formData: { ...head, 单据编号: no, detail: { items } } })
console.log(`    审核检验单 = ${JSON.stringify(au).slice(0, 200)}`)
ok('② 组装成品检验单已审核(本轮审核 或 上一轮遗留)',
  alreadyAudited || au.code === 200, alreadyAudited ? '已审核(幂等跳过)' : JSON.stringify(au).slice(0, 160))
await show('检验审核后')

// 审核自动生成的产成品入库单
const fin = (await api('/px/queryFormDataList', { panelCode: 'FINISH_IN', pageNo: 1, pageSize: 200 })).data || {}
const frows = fin.rows || fin.list || fin.items || []
const fMine = frows.filter((x) => String(x['加工单号']) === WO && String(x['单据状态'] || '') !== '已作废')
console.log(`    产成品入库单 = ${JSON.stringify(fMine.map((x) => ({ 单: x['单据编号'], 行: x['工单行号'], 状态: x['单据状态'] })))}`)
ok('③ 检验审核后有产成品入库单(本轮自动生成 或 上一轮遗留)', fMine.length > 0, `n=${fMine.length}`)
if (fMine.length) {
  const fno = fMine[0]['单据编号']
  // 同样把单头字段带回去(FINISH_IN 也是 doc 面板,只传单据编号会报「缺少表单编号」)
  const fhead = { ...fMine[0] }
  delete fhead['detail']
  const fAlready = String(fMine[0]['单据状态'] || '') === '已审核'
  const fa = fAlready ? { code: 200, message: 'skip(已审核)' }
    : await api('/px/callButton', { panelCode: 'FINISH_IN', buttonName: '审核', buttonParam: {}, formData: { ...fhead, 单据编号: fno } })
  console.log(`    审核入库单 ${fno} = ${JSON.stringify(fa).slice(0, 200)}`)
  ok('④ 入库单已审核(本轮审核 或 上一轮遗留)', fAlready || fa.code === 200, JSON.stringify(fa).slice(0, 160))
  const after = await show('入库审核后')
  ok('⑤ 入库≥排产 ⇒ 结案=Y(组装成品检验已审核 + 入库达标)', String(after['结案']) === 'Y', `结案=${after['结案']}`)
  ok('⑤ 生产状态 = 已结案', String(after['生产状态']) === '已结案', String(after['生产状态']))
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
