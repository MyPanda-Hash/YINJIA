/** 验证「电脑端手工建单也会按账号所属部门带入领料部门」(不经过手机端控制器的显式赋值)。 */
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
// 手工建一张生产领料单草稿(只给必填 + 一行明细)
const saved = await call('/api/px/callButton', {
  panelCode: 'MATERIAL_OUT',
  buttonName: '保存',
  formData: {
    单据日期: '2026-11-24',
    业务类型: '生产领料',
    备注: 'QA: 验证部门自动带入(无手机端参与)',
    detail: { items: [{ 行号: '1', 材料编码: 'YJ-KBL-012', 材料名称: 'PE袋', 计量单位: '个', 数量: 1, 仓库: '恒亿仓', 仓库编码: 'YCL-01' }] },
  },
  buttonParam: {},
}, token)
console.log('保存:', JSON.stringify(saved).slice(0, 200))
