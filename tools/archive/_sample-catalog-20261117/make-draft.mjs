// 建一张检验委托单草稿(测试库 YJ_TEST),供界面取证用;并打印单据编号
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
console.log('login code =', login?.code, 'token =', token ? 'ok' : 'MISSING')
const call = async (path, body) => {
  const r = await fetch(BASE + '/api' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 400) } }
  return { http: r.status, ...j }
}
const c = await call('/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '保存', formData: {}, buttonParam: {} })
console.log('create =', JSON.stringify({ http: c.http, code: c.code, message: c.message, data: c.data }).slice(0, 600))
const no = c.data?.['编号'] || c.data?.formNo || c.data?.单据编号
console.log('DOCNO=' + (no || ''))
