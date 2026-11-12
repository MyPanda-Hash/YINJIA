// 验证「表观单解绑产成品入库」:TEST 账套 ZJ-2026-10-0135(草稿/18 行)
//   保存(无合格数量) → 提交审批 → 审批通过(必要时两级) → 弃审;全程核对 FINISH_IN 数量不变
const BASE = 'http://127.0.0.1:8090/api'
const DOC = 'ZJ-2026-10-0135'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_ASM_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const call = (buttonName, formData) => fetch(`${BASE}/px/callButton`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_ASM_INSP', buttonName, formData: formData || {} }),
}).then((r) => r.json())
const finishInCount = async () => {
  const r = await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'FINISH_IN', condition: {}, pageNo: 1, pageSize: 1000 }),
  }).then((x) => x.json())
  return (r?.data?.list || []).length
}
const flowCount = async () => {
  const r = await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'FINISH_IN', condition: { 备注: DOC }, pageNo: 1, pageSize: 100 }),
  }).then((x) => x.json())
  return (r?.data?.list || []).length
}

const d0 = await getDesc()
const head = { ...d0.head }
const base = { ...head, 编号: head['编号'], detail: { items: d0.items.map((r) => ({ ...r })) } }
delete base['检测周期']
console.log('BEFORE=' + JSON.stringify({ status: head['单据状态'], 合格数量: head['合格数量'], 检验数量: head['检验数量'], items: d0.items.length, finishIn: await finishInCount() }))

const rSave = await call('保存', base)
const rSubmit = await call('提交审批', { 编号: head['编号'] })
let approvals = []
for (let i = 0; i < 2; i++) {
  const r = await call('审批通过', { 编号: head['编号'], 审批意见: '验证解绑' })
  const st = (await getDesc()).head['单据状态']
  approvals.push({ i: i + 1, code: r.code, msg: r.message, status: st })
  if (!/待二级审批/.test(String(st))) break
}
const afterApprove = await getDesc()
const flowAfter = await finishInCount()
console.log('FLOW=' + JSON.stringify({
  save: { code: rSave.code, msg: rSave.message },
  submit: { code: rSubmit.code, msg: rSubmit.message },
  approvals,
  status: afterApprove.head['单据状态'],
  finishIn: flowAfter,
  finishInWithRemark: await flowCount(),
}))
const rUnaudit = await call('弃审', { 编号: head['编号'] })
const afterUnaudit = await getDesc()
console.log('UNAUDIT=' + JSON.stringify({ code: rUnaudit.code, msg: rUnaudit.message, status: afterUnaudit.head['单据状态'], 合格数量: afterUnaudit.head['合格数量'] }))
