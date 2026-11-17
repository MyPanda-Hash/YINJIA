// round-54:出货检验表观审批流验收(测试账套 ZJ-2026-10-0071):提交审批→审批通过→已审核→弃审回草稿
// 同时验证检测周期:提交后仍单端、审批通过后才出现第二端、弃审后回退单端
const BASE = 'http://127.0.0.1:8090/api'
const DOC = 'ZJ-2026-10-0085'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const getDesc = async () => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_ASM_INSP&code=${DOC}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  const h = d?.data || {}
  return { 状态: h['单据状态'], 审核人: h['审核人'], 审核时间: h['审核时间'], 检测周期: h['检测周期'], rows: (d?.detailData?.items || []).length }
}
const call = (buttonName) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_ASM_INSP', buttonName, formData: { 编号: DOC } }) }).then((r) => r.json())

console.log('BEFORE=' + JSON.stringify(await getDesc()))
const r1 = await call('提交审批'); console.log('SUBMIT=' + JSON.stringify({ code: r1.code, msg: (r1.message || '').slice(0, 120) }) + ' => ' + JSON.stringify(await getDesc()))
const r2 = await call('审批通过'); console.log('APPROVE=' + JSON.stringify({ code: r2.code, msg: (r2.message || '').slice(0, 120) }) + ' => ' + JSON.stringify(await getDesc()))
const r3 = await call('弃审'); console.log('UNAUDIT=' + JSON.stringify({ code: r3.code, msg: (r3.message || '').slice(0, 120) }) + ' => ' + JSON.stringify(await getDesc()))
