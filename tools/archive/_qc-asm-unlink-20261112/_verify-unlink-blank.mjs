// 补充验证:表观单在「合格数量为空」时保存/提交/审批全链路不被拦住(用户实际场景:新纸面没有这一格)
const BASE = 'http://127.0.0.1:8090/api'
const DOC = 'ZJ-2026-10-0135'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_ASM_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const call = (buttonName, formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_ASM_INSP', buttonName, formData }) }).then((r) => r.json())
const d = await getDesc()
const head = { ...d.head }
delete head['检测周期']
const items = d.items.map((r) => ({ ...r }))
const saveBlank = await call('保存', { ...head, 合格数量: '', 编号: head['编号'], detail: { items } })
const afterBlank = await getDesc()
const submit = await call('提交审批', { 编号: head['编号'] })
const approve = await call('审批通过', { 编号: head['编号'], 审批意见: '空合格数量验证' })
const afterAudit = await getDesc()
const unaudit = await call('弃审', { 编号: head['编号'] })
const back = await getDesc()
// 还原合格数量=100(测试单原值)
const restore = await call('保存', { ...back.head, 合格数量: 100, 编号: head['编号'], detail: { items: back.items.map((r) => ({ ...r })) } })
const final = await getDesc()
console.log(JSON.stringify({
  saveBlank: { code: saveBlank.code, msg: saveBlank.message, valAfter: afterBlank.head['合格数量'] },
  submit: { code: submit.code, msg: submit.message },
  approve: { code: approve.code, msg: approve.message, status: afterAudit.head['单据状态'] },
  unaudit: { code: unaudit.code, msg: unaudit.message, status: back.head['单据状态'] },
  restore: { code: restore.code, 合格数量: final.head['合格数量'] },
}))
