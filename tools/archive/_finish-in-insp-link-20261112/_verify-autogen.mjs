// 验证 phase2b:审核一张「最后一道工序(组装)+批次」的报工单 → 自动生成产成品入库单草稿
const BASE = 'http://127.0.0.1:8090/api'
const REPORT = 'BG-AUTOGEN-TEST-01'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const call = (panelCode, buttonName, formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((r) => r.json())
const list = async (panelCode, condition = {}) => {
  const r = await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, condition, pageNo: 1, pageSize: 50 }) }).then((x) => x.json())
  return (r?.data?.list || [])
}
const audit = await call('WO_REPORT', '审核', { 编号: REPORT })
console.log('AUDIT_REPORT=' + JSON.stringify({ code: audit.code, msg: audit.message, status: audit?.data?.状态 || audit?.data?.['单据状态'] }))
const fis = (await list('FINISH_IN')).filter((r) => ['20261112', 'GD-2026-10-0015'].includes(String(r['批次号'] || '')) || String(r['加工单号'] || '') === 'GD-2026-10-0015')
console.log('GENERATED=' + JSON.stringify(fis.map((r) => ({
  编号: r['编号'], 状态: r['单据状态'], 加工单号: r['加工单号'], 工单行号: r['工单行号'], 批次号: r['批次号'],
  出货检验功能单号: r['出货检验功能单号'], 出货检验表观单号: r['出货检验表观单号'], 业务类型: r['业务类型'],
}))))
