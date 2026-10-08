// 按钮权限 + 面板配置里的 actionPrivileges / 前端分发依赖项
const BASE = 'http://127.0.0.1:8090'
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const parsed = await res.json()
  if (parsed.code && parsed.code !== 200) throw new Error(`${path}: ${parsed.code} ${parsed.message}`)
  return parsed
}
const lg = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' }, null)
const token = lg.data.token
console.log('登录用户 isAdmin =', lg.data.user?.isAdmin)

for (const code of ['WH', 'WHLOC']) {
  const cfg = await api('GET', `/api/px/getPanelConfig?panelCode=${code}`, null, token)
  console.log(`\n########## ${code} ##########`)
  console.log('actionPrivileges:', JSON.stringify(cfg.data.privilege?.actionPrivileges))
  const m = cfg.data.metadata
  console.log('metadata 顶层键  :', Object.keys(m).join(' / '))
  // 关键:二维码标签按钮的渲染条件是否齐备
  if (code === 'WHLOC') {
    console.log('  qrLabelKind    =', m.qrLabelKind)
    console.log('  qrLabelKey     =', m.qrLabelKey)
    console.log('  qrLabelScopeKey=', m.qrLabelScopeKey)
  }
  // 新增表单默认值(新增按钮点下去会带什么)
  const nf = await api('GET', `/api/px/getNewFormPermMatrix?panelCode=${code}&operationName=${encodeURIComponent('新增流程')}`, null, token)
  console.log('新增默认数据     :', JSON.stringify(nf.data.data))
}

// 只读动作探测:刷新/查找 走 callButton 是否会报错(不碰保存/删除)
for (const code of ['WH', 'WHLOC']) {
  for (const act of ['刷新']) {
    try {
      const r = await api('POST', '/api/px/callButton', { panelCode: code, buttonName: act, data: {}, items: [] }, token)
      console.log(`\ncallButton ${code} / ${act} -> ok=${r.data?.ok ?? '(无 ok 字段)'} keys=${Object.keys(r.data || {}).slice(0, 6).join(',')}`)
    } catch (e) { console.log(`\ncallButton ${code} / ${act} -> ★失败: ${e.message}`) }
  }
}
