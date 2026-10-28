/**
 * 部署前后基线快照(只读):确认热更新只换了代码,服务器数据没被动过。
 * 用法: node _baseline.mjs http://36.140.66.163:8090 admin 123456 <label>
 * 输出一行行 KEY=VALUE,便于前后 diff。
 */
const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456', label = ''] = process.argv.slice(2)

async function req(p, { method = 'GET', body, token } = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch { return { code: r.status, message: t.slice(0, 120) } }
}

async function login(factory) {
  const j = await req('/api/auth/login', { method: 'POST', body: { userName: user, password: pass, factory } })
  return j?.data?.token || ''
}

const out = []
const put = (k, v) => out.push(`${k}=${v}`)

put('label', label || '-')
put('base', base)

for (const [factory, tag] of [['YJ', 'prod'], ['YJ_TEST', 'test']]) {
  const token = await login(factory)
  put(`${tag}.login`, token ? 'ok' : 'FAIL')
  if (!token) continue
  const cfg = await req('/api/dc/config', { token })
  const k = cfg?.data?.kpis || {}
  put(`${tag}.dc.devices`, k.deviceTotal)
  put(`${tag}.dc.gatewayBound`, k.gatewayBound)
  put(`${tag}.dc.fullyReady`, k.fullyReady)
  put(`${tag}.dc.gateways`, (cfg?.data?.gateways || []).length)
  // 研发立项单数(热更新不该动它)
  const flow = await req('/api/px/rdFlow', { token })
  put(`${tag}.rd.approvals`, Array.isArray(flow?.data?.projects) ? flow.data.projects.length : `n/a(${flow?.code})`)
  // 面板矩阵条数(权限行不该被动过)
  const info = await req('/api/auth/userinfo', { token })
  const ui = info?.data || {}
  put(`${tag}.panels.visible`, (ui.visiblePanels || []).length)
  put(`${tag}.panels.approval`, (ui.approvePanels || []).length)
  // 业务数据行数(热更新不该动任何业务数据)
  for (const panel of ['RD_APPROVAL', 'RD_PLAN', 'MATERIAL_OUT', 'PU_RECEIPT']) {
    const rs = await req('/api/px/queryFormDataList', {
      method: 'POST', token, body: { panelCode: panel, pageNo: 1, pageSize: 1 },
    })
    const total = rs?.data?.total ?? rs?.data?.totalCount ?? (Array.isArray(rs?.data?.list) ? rs.data.list.length : 'n/a')
    put(`${tag}.rows.${panel}`, total)
  }
}

console.log(out.join('\n'))
