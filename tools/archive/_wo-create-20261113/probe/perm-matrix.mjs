// 校验「生产工单」页面动作词 create(新增)已出现在权限矩阵元数据里(role 2 = 普通用户)
const BASE = 'http://127.0.0.1:8091'
const post = async (p, b, t) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b || {}) })
  const j = await r.json()
  if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + JSON.stringify(j).slice(0, 200))
  return j.data ?? j
}
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.token
const r = await fetch(BASE + '/api/sys/role/2/panels', { headers: { Authorization: 'Bearer ' + token } })
const j = await r.json()
const data = j.data ?? j
const flat = []
for (const [mod, list] of Object.entries(data)) {
  if (!Array.isArray(list)) continue
  for (const p of list) if (p.panelCode === 'WORK_ORDER_LIST') flat.push({ mod, ...p })
}
console.log(JSON.stringify(flat, null, 1))
const def = flat.find((x) => Array.isArray(x.actions)) || {}
const granted = flat.find((x) => typeof x.perms === 'string') || {}
const hasCreate = (def.actions || []).some((a) => a[0] === 'create')
const rolePerm = String(granted.perms || '')
console.log('矩阵含 create 动作=' + hasCreate + ' 角色已授权 create=' + rolePerm.includes('create') + ' perms=' + rolePerm)
