/* 只读探针:两个新面板在 8090 现役实例上的配置/取数是否正常(不改数据) */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'

async function login(factory) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300))
  return j.data.token
}

function api(token) {
  return async (method, path, body) => {
    const r = await fetch(BASE + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let j
    try { j = JSON.parse(text) } catch { j = { raw: text.slice(0, 400) } }
    return { http: r.status, j }
  }
}

const out = []
for (const factory of ['YJ', 'YJ_TEST']) {
  const token = await login(factory)
  const call = api(token)
  for (const code of ['SAMPLE_REG', 'INSP_COMMISSION']) {
    const cfg = await call('GET', `/px/getPanelConfig?panelCode=${code}`)
    const md = cfg.j?.data?.metadata || {}
    const header = (cfg.j?.data?.dataSchema?.headerFields || []).map((f) => f.dataName || f.label || f.name)
    const tabs = cfg.j?.data?.detail?.tabs || []
    out.push({
      factory, panel: code, http: cfg.http, code: cfg.j?.code,
      panelName: md.panelName, mode: cfg.j?.data?.metadata?.panel?.[0]?.mode,
      headerCount: header.length, headerFirst: header.slice(0, 8),
      tabs: tabs.map((t) => ({ key: t.key, label: t.label, fields: (t.fields || []).length })),
      btns: (md.buttonGroups || []).map((g) => (g.actions || []).join('/')),
      hasApproveGroup: (md.buttonGroups || []).some((g) => (g.actions || []).includes('提交审批')),
      queryFields: ((cfg.j?.data?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields) || []).map((f) => f.dataName),
    })
    const q = await call('POST', '/px/queryFormDataList', { panelCode: code, keyword: '', condition: {}, pageNo: 1, pageSize: 50 })
    const list = q.j?.data?.list || []
    const items = code === 'SAMPLE_REG' ? (list[0]?.detail?.items || []) : []
    out.push({
      factory, panel: code, queryHttp: q.http, queryCode: q.j?.code,
      totalSize: q.j?.data?.totalSize, listLen: list.length,
      firstDoc: list[0] ? Object.fromEntries(Object.entries(list[0]).filter(([k]) => k !== 'detail').slice(0, 6)) : null,
      detailRows: code === 'SAMPLE_REG' ? items.length : (list[0]?.detail?.items || []).length,
      detailFirst: items[0] || null,
    })
  }
}
console.log(JSON.stringify(out, null, 1))
