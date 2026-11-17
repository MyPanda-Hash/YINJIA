// happy-path:两张检验单都审核后,产成品入库单关联它们并按批次提交 → 应通过
const BASE = 'http://127.0.0.1:8090/api'
const ASM = 'ZJ-2026-10-0135'
const PROC = 'ZC-2026-10-0126'
const FI = 'FI-LINKTEST-01'
const BATCH = '20261017'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const call = (panelCode, buttonName, formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((r) => r.json())
const status = async (panelCode, code) => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=${panelCode}&code=${code}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  return ((r?.data?.data) || {})['单据状态'] || (r?.data || {})['单据状态']
}
const submitAndApprove = async (panelCode, code) => {
  const a = await call(panelCode, '提交审批', { 编号: code })
  const b = await call(panelCode, '审批通过', { 编号: code, 审批意见: '门禁验证' })
  return { submit: { code: a.code, msg: a.message }, approve: { code: b.code, msg: b.message }, status: await status(panelCode, code) }
}
console.log('ASM=' + JSON.stringify(await submitAndApprove('QC_ASM_INSP', ASM)))
console.log('PROC=' + JSON.stringify(await submitAndApprove('QC_PROC_INSP', PROC)))

const save = await call('FINISH_IN', '保存为草稿', {
  编号: FI,
  出货检验功能单号: PROC,
  出货检验表观单号: ASM,
  批次号: BATCH,
})
const submit = await call('FINISH_IN', '提交审批', { 编号: FI })
console.log('FI=' + JSON.stringify({ save: { code: save.code, msg: save.message }, submit: { code: submit.code, msg: submit.message }, status: await status('FINISH_IN', FI) }))
