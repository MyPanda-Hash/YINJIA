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
const a = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '新增', formData: {}, buttonParam: {} })
console.log('新增 =>', JSON.stringify(a).slice(0, 800))
const b = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '保存', formData: { 单据日期: '2026-11-15', 委托单位: '调试委托单位', 样品名称: '调试水样' }, buttonParam: {} })
console.log('保存 =>', JSON.stringify(b).slice(0, 800))
