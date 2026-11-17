// 保存草稿(用界面同样的 label 键,含「标准方法检出限」)→ 读回校验 → 删除草稿(测试库)
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOCNO = 'WT-2026-11-9008'
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const call = async (path, body) => {
  const r = await fetch(BASE + '/api' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 300) } }
  return { http: r.status, code: j.code, message: j.message, data: j.data }
}
const item = (no, elem, limit, fee) => ({
  行号: no, 检测元素: elem, 标准方法检出限: limit, 检测误差: '',
  测试方法: 'ICPMS', 测试周期: '2-3个工作日出数据，5个工作日出报告',
  '收费（一个样/元）': fee, 检测标准: 'GB/T 5750.6-2023', 检测标准备注: '生活饮用水标准检验方法',
})
const save = await call('/px/callButton', {
  panelCode: 'INSP_COMMISSION', buttonName: '保存',
  formData: {
    编号: DOCNO, 单据编号: DOCNO,
    联系人: '系统管理员', 样品名称: '联调样品(锂钠)', 样品数量: '2L', '样品型号/规格': '水样',
    检验类别: '锂、钠', 检验依据: 'GB/T 5750.6-2023', 合计收费: 212.0,
    detail: { items: [item(1, '锂', '0.0006mg/L', 100), item(2, '钠', '0.02mg/L', 100)] },
  },
  buttonParam: {},
})
console.log('SAVE =', JSON.stringify({ http: save.http, code: save.code, message: save.message }).slice(0, 300))

const back = await call('/px/queryFormDataList', { panelCode: 'INSP_COMMISSION', keyword: DOCNO, condition: {}, pageNo: 1, pageSize: 5 })
const doc = (back.data?.list || [])[0]
const items = doc?.detail?.items || (doc?.detail && Object.values(doc.detail).find(Array.isArray)) || []
console.log('READBACK 单据编号 =', doc?.['单据编号'], '检验类别 =', doc?.['检验类别'], '合计收费 =', doc?.['合计收费'])
console.log('READBACK 行 key 样本 =', items[0] ? Object.keys(items[0]).filter((k) => /检出限|误差|元素/.test(k)) : [])
console.log('READBACK 行值 =', JSON.stringify(items.map((x) => ({ 元素: x['检测元素'], 新键: x['标准方法检出限'], 旧键: x['内部检出限'] ?? '<absent>' }))))
