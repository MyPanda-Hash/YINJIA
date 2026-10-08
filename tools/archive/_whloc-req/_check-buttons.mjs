// 查看 WH(仓库) / WHLOC(仓位) 两个面板的按钮组与面板按钮(8090 实跑)
const BASE = 'http://127.0.0.1:8090'
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const parsed = await res.json()
  if (parsed.code && parsed.code !== 200) throw new Error(`${path}: ${parsed.code} ${parsed.message}`)
  return parsed
}
const token = (await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' }, null)).data.token

for (const code of ['WH', 'WHLOC']) {
  const cfg = await api('GET', `/api/px/getPanelConfig?panelCode=${code}`, null, token)
  const m = cfg.data.metadata
  console.log(`\n########## ${code} · ${m.panelName} ##########`)
  console.log('panelButtons   :', (m.panelButtons || []).map((b) => b.buttonName).join(' / '))
  console.log('buttonGroups   :')
  for (const g of m.buttonGroups || []) console.log(`   [${g.groupName || g.title || g.name}] ${(g.actions || []).join(' , ')}`)
  const tp = m.panelPageDto?.tablePages?.[0]
  console.log('topBarBtn      :', (tp?.topBarBtn || []).map((b) => b.buttonName).join(' / '))
  console.log('rowOperationBar:', (tp?.rowOperationBarBtn || []).map((b) => b.buttonName).join(' / '))
  const fp = m.panelPageDto?.formPages?.[0]
  console.log('form bottomBar :', (fp?.bottomOperationBarBtn || []).map((b) => b.buttonName).join(' / '))
  console.log('qrLabel        :', m.qrLabelKind ?? '(无)', '| key=', m.qrLabelKey ?? '-', '| scope=', m.qrLabelScopeKey ?? '-')
  console.log('panelState     :', JSON.stringify(m.panelState))
  console.log('查询字段       :', (tp?.queryFields || []).map((f) => f.dataName).join(' / '))
}
