// repro-8114:在测试账套复现「QC_PROC_INSP 保存 → error 8114 (nvarchar→numeric)」
const BASE = 'http://127.0.0.1:8090/api'
const DOC = 'ZC-2026-11-0023'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const desc = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json())
const d = desc?.data || desc
const head = { ...(d?.data || {}) }
const items = (d?.detailData?.items || [])
console.log('HEAD_KEYS=' + JSON.stringify(Object.keys(head)))
console.log('HEAD_NUM=' + JSON.stringify({ 报工数量: head['报工数量'], 抽检总量: head['抽检总量'], 检验数量: head['检验数量'], 列数: head['列数'], 工单行号: head['工单行号'] }))
console.log('HEAD_ALL=' + JSON.stringify(head).slice(0, 1200))

const baseForm = (extraHead = {}, extraItems = []) => {
  const h = { ...head, 编号: DOC, ...extraHead }
  for (const k of ['单据状态', '创建时间', '更新时间', '发起人编号']) delete h[k]
  return { ...h, 编号: DOC, detail: { items: [...items, ...extraItems] } }
}
const newRow = { 表区: '', 行号: 1, 检验项目: '外观', 检验要求: '清洁、无破损', 检验方法: '目视检查', 内部批次: '1', 结果判断: '合格' }
const cases = [
  ['原样保存为草稿(无新增行)', baseForm({}, []), '保存为草稿'],
  ['加一行+批次清单(保存为草稿)', baseForm({ 内部批次清单: '1', 表单审核人: '冯敏' }, [newRow]), '保存为草稿'],
  ['加一行+批次清单(保存=提交)', baseForm({ 内部批次清单: '1', 表单审核人: '冯敏' }, [newRow]), '保存'],
  ['加一行但不带批次字段(保存为草稿)', baseForm({}, [{ ...newRow, 内部批次: undefined }]), '保存为草稿'],
]
for (const [name, formData, button] of cases) {
  try {
    const r = await fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName: button, formData }) }).then((x) => x.json())
    console.log('CASE=' + name + ' => ' + JSON.stringify({ code: r.code, msg: (r.message || '').slice(0, 160) }))
  } catch (e) { console.log('CASE=' + name + ' => THROW ' + e.message) }
}
