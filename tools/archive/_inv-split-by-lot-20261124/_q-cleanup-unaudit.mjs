/** 验证完的清理:弃审生产领料单(冲回库存)+ 删掉两张验证单据 + 领料单退回未完成。 */
const base = 'http://127.0.0.1:8090'
async function call(path, body, token, method = 'POST') {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j.code && j.code !== 200)) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 400)}`)
  return j.data ?? j
}
const login = await call('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
const token = login.token
const unaudit = await call('/api/px/callButton', {
  panelCode: 'MATERIAL_OUT', buttonName: '弃审', formData: { 编号: 'LL-2026-11-0047' }, buttonParam: {},
}, token)
console.log('弃审:', JSON.stringify(unaudit).slice(0, 200))
