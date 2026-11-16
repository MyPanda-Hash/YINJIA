const BASE = 'http://127.0.0.1:8090'
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const call = async (method, path, body) => {
  const r = await fetch(BASE + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 300) }
  return { http: r.status, j }
}
// 建一张空白草稿(新增)
const a = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '新增', formData: {}, buttonParam: {} })
const no = a.j?.data?.['编号']
// 读回这张单
const q = await call('POST', '/px/queryFormDataList', { panelCode: 'INSP_COMMISSION', keyword: no, condition: {}, pageNo: 1, pageSize: 5 })
const doc = (q.j?.data?.list || []).find((d) => (d['单据编号'] || d['编号']) === no)
console.log(JSON.stringify({
  no,
  found: !!doc,
  status: doc?.['单据状态'],
  单据日期: doc?.['单据日期'],
  样品处理方式: doc?.['样品处理方式'],
  判定规则: doc?.['判定规则'],
  检验报告有效期: doc?.['检验报告有效期'],
}, null, 1))
