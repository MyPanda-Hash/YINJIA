// round-52:8114 修复验证(测试账套 ZC-2026-11-0023)—— 文本进抽检量不再 500、数字照常保存、验完还原
const BASE = 'http://127.0.0.1:8090/api'
const DOC = 'ZC-2026-11-0023'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const saveDraft = (formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿', formData }) }).then((r) => r.json())
const cur = await getDesc()
const baseHead = { ...cur.head, 编号: DOC }
for (const k of ['单据状态', '创建时间', '更新时间', '发起人编号']) delete baseHead[k]
const mk = (over) => ({ 表区: '检验要求', 行号: 1, 检验项目: '外观', 检验要求: '清洁、无破损', 检验方法: '目视检查', 检查频率: '1PCS/一个生产批次', 内部批次: '1', 结果判断: '合格', ...over })

const cases = [
  ['文本「每批5件」进抽检量(旧版会 500)', mk({ 抽检量: '每批5件' })],
  ['文本「称取100g」进抽检量(旧版会 500)', mk({ 抽检量: '称取100g', 检验项目: '尺寸' })],
  ['数字 5 进抽检量(应原样保存为 5)', mk({ 抽检量: 5, 检验项目: '重量' })],
]
for (const [name, row] of cases) {
  const r = await saveDraft({ ...baseHead, 内部批次清单: '1', detail: { items: [row] } })
  const after = await getDesc()
  const saved = after.items.map((x) => ({ 检验项目: x['检验项目'], 抽检量: x['抽检量'], 内部批次: x['内部批次'], 结果判断: x['结果判断'] }))
  console.log('CASE=' + name + ' => ' + JSON.stringify({ code: r.code, msg: (r.message || '').slice(0, 100), rows: after.items.length, saved }))
}
// 还原:该单原始 0 行 ⇒ 提交空明细(缺席行软删)
const restore = await saveDraft({ ...baseHead, 内部批次清单: null, 表单审核人: null, detail: { items: [] } })
const back = await getDesc()
console.log('RESTORE=' + JSON.stringify({ code: restore.code, rows: back.items.length }))
