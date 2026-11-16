// 验证产成品入库单「关联两张检验单」门禁(测试账套):用一张现成草稿单,清空两个关联单号后提交审批,应被拒
const BASE = 'http://127.0.0.1:8090/api'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const call = (panelCode, buttonName, formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((r) => r.json())
const list = async (panelCode) => {
  const r = await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize: 10 }) }).then((x) => x.json())
  return (r?.data?.list || [])
}
const getDesc = async (panelCode, code) => {
  const r = await fetch(`${BASE}/px/getFormDescriptor?panelCode=${panelCode}&code=${code}`, { headers: { Authorization: 'Bearer ' + token } }).then((x) => x.json())
  const d = r?.data || r
  return { head: d?.data || {}, items: (d?.detailData?.items || []) }
}
const rows = await list('FINISH_IN')
console.log('FINISH_IN=' + JSON.stringify(rows.slice(0, 5).map((r) => ({ 编号: r['编号'], 状态: r['单据状态'], 批次号: r['批次号'], 外部单据号: r['外部单据号'], 出货检验功能单号: r['出货检验功能单号'] }))))
const target = rows.find((r) => (r['单据状态'] || '') === '草稿' && !String(r['外部单据号'] || '').trim())
if (!target) { console.log('NO_DRAFT'); process.exit(0) }
const doc = target['编号']
const d = await getDesc('FINISH_IN', doc)
const head = { ...d.head }
delete head['检测周期']
// 显式清空两个关联单号(模拟"没关联就想提交")
const r1 = await call('FINISH_IN', '保存为草稿', { ...head, 出货检验功能单号: '', 出货检验表观单号: '', 编号: doc })
const r2 = await call('FINISH_IN', '提交审批', { 编号: doc })
console.log('NO_LINK=' + JSON.stringify({ doc, save: { code: r1.code, msg: r1.message }, submit: { code: r2.code, msg: r2.message } }))
// 只填一个也应拒
await call('FINISH_IN', '保存为草稿', { ...head, 出货检验功能单号: 'ZC-2026-10-0001', 出货检验表观单号: '', 编号: doc })
const r3 = await call('FINISH_IN', '提交审批', { 编号: doc })
console.log('ONE_LINK=' + JSON.stringify({ submit: { code: r3.code, msg: r3.message } }))
// 两个都填但检验单未审核 / 批次为空等
await call('FINISH_IN', '保存为草稿', { ...head, 出货检验功能单号: 'ZC-2026-10-0001', 出货检验表观单号: 'ZJ-2026-10-0135', 编号: doc })
const r4 = await call('FINISH_IN', '提交审批', { 编号: doc })
console.log('TWO_LINK=' + JSON.stringify({ submit: { code: r4.code, msg: r4.message } }))
