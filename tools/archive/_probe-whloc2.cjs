// _probe-whloc2.cjs — WHLOC 第二轮:GET 配置(en 走 Accept-Language)+ 明细行查询(正确路径)+ 参照下拉数据源
const BASE = 'http://127.0.0.1:8090/api'

async function api(method, path, body, token, lang) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(lang ? { 'Accept-Language': lang } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function main() {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = login.body?.data?.token
  console.log('login:', login.status, token ? 'ok' : 'FAIL')

  // zh 配置(GET + Accept-Language zh)
  const zh = await api('GET', '/px/getPanelConfig?panelCode=WHLOC', null, token, 'zh-CN')
  const dz = zh.body?.data || {}
  const tabZ = dz.detail?.tabs?.[0] || {}
  console.log('[zh] panel:', dz.metadata?.panelName, '| tab:', tabZ.key, tabZ.label)
  console.log('[zh] fields:', (tabZ.fields || []).map((f) => `${f.dataName}(${f.dataType}${f.ref?.panel ? '→' + f.ref.panel + '[' + f.ref.refField + '→' + f.ref.displayField + ']' : ''}${f.isRequired ? '*' : ''})`).join('  '))
  console.log('[zh] queryFields:', (dz.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).map((f) => f.dataName).join('/'))

  // en 配置
  const en = await api('GET', '/px/getPanelConfig?panelCode=WHLOC', null, token, 'en')
  const de = en.body?.data || {}
  const tabE = de.detail?.tabs?.[0] || {}
  console.log('[en] panel:', de.metadata?.panelName, '| tab:', tabE.label)
  console.log('[en] fields:', (tabE.fields || []).map((f) => `${f.dataName}=>${f.displayName}`).join('  '))
  console.log('[en] queryFields:', (de.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).map((f) => `${f.dataName}=>${f.displayName}`).join('/'))

  // 明细行数据(正确路径 list[0].detail.locations)
  const list = await api('POST', '/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 50 }, token)
  const doc = list.body?.data?.list?.[0]
  const rows = doc?.detail?.locations || []
  console.log('list:', list.status, '| doc 编号:', doc?.编号, '| 状态:', doc?.单据状态, '| live rows:', rows.length)
  for (const r of rows) console.log('  live:', JSON.stringify({ 仓库: r['仓库'], 库位编码: r['库位编码'], 库位地址: r['库位地址'] }))

  // 参照数据源(WH 仓库下拉/弹窗的候选;GET refOptions 类接口——直接走 getRefSelectOptions 若有;无则跳过)
  const ref = await api('GET', '/px/getRefRows?panelCode=WH&field=' + encodeURIComponent('仓库') + '&keyword=', null, token)
  console.log('ref probe:', ref.status, JSON.stringify(ref.body).slice(0, 120))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
