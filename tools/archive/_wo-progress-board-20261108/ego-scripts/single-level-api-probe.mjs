// 2026-11-09 单级审批验证(测试账套):首件/制程 提交审批 → 审批通过(一次) → 已审核 → 弃审 → 草稿
// 只写 HSDZ_MES_TEST;测完恢复草稿原状。
const BASE = 'http://127.0.0.1:8090/api'
async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const t = await res.text()
  let j; try { j = JSON.parse(t) } catch { j = { code: -1, message: t.slice(0, 300) } }
  return { http: res.status, json: j }
}
async function doc(panel, no, token) {
  const r = await post('/px/queryFormDataList', { panelCode: panel, keyword: no, pageNo: 1, pageSize: 10, condition: {} }, token)
  const list = r.json?.data?.list || []
  return list.find((d) => String(d['编号'] || '') === no) || list[0] || null
}
const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
const token = login.json?.data?.token
console.log('[login]', login.http, login.json?.code, token ? 'TEST token ok' : JSON.stringify(login.json).slice(0, 200))

const cases = [
  ['QC_FIRST_INSP', 'SJ-2026-10-0153', '首件检验单'],
  ['QC_PROC_INSP', 'ZC-2026-10-0126', '制程检验单'],
]
for (const [panel, no, label] of cases) {
  console.log(`\n===== ${label} ${no} =====`)
  let d = await doc(panel, no, token)
  if (!d) { console.log('  未取到该单(可能不在测试库),跳过'); continue }
  console.log('  初始:', JSON.stringify({ 单据状态: d['单据状态'], 审核人: d['审核人'] || '', 审批人: d['审批人'] || '', 检验员: d['检验员'] || '' }))

  const click = async (btn) => {
    const r = await post('/px/callButton', { panelCode: panel, buttonName: btn, formData: { 单据编号: no, 编号: no }, buttonParam: {} }, token)
    return r
  }
  const submit = await click('提交审批')
  console.log('  提交审批:', submit.http, submit.json?.code, submit.json?.data?.单据状态 || submit.json?.message || '')
  d = await doc(panel, no, token)
  console.log('  提交后:', JSON.stringify({ 单据状态: d['单据状态'], 审批状态: d['审批状态'], 审核人: d['审核人'] || '', 检验员: d['检验员'] || '' }))

  const approve = await click('审批通过')
  console.log('  审批通过(一次):', approve.http, approve.json?.code, approve.json?.data?.单据状态 || approve.json?.message || '')
  d = await doc(panel, no, token)
  console.log('  审批后:', JSON.stringify({ 单据状态: d['单据状态'], 审核人: d['审核人'] || '', 审核时间: d['审核时间'] || '', 审批人: d['审批人'] || '' }))

  const unaudit = await click('弃审')
  console.log('  弃审:', unaudit.http, unaudit.json?.code, unaudit.json?.data?.单据状态 || unaudit.json?.message || '')
  d = await doc(panel, no, token)
  console.log('  弃审后:', JSON.stringify({ 单据状态: d['单据状态'], 审核人: d['审核人'] || '', 审批人: d['审批人'] || '' }))
}
