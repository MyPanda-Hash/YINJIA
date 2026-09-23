const BASE = 'http://localhost:8090/api'
const t0 = Date.now()
async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const H = { Authorization: `Bearer ${login.data.token}` }
  console.log('登录:', login?.data?.token ? 'OK' : 'FAIL', `(${Date.now() - t0}ms)`)
  for (const code of ['QC_CATALOG', 'QC_INSP_REC', 'QC_INSP', 'QC_RECV']) {
    const t = Date.now()
    try {
      const c = await (await fetch(`${BASE}/px/getPanelConfig?panelCode=${code}`, { headers: H })).json()
      const m = c?.data?.metadata
      const r = await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ panelCode: code, pageNo: 1, pageSize: 5, condition: {} }) })).json()
      const n = (r?.data?.list || []).length
      console.log(`${code}: 配置OK panelName=${m?.panelName} docArchive=${m?.docArchive ?? '-'} 列表=${n} 张  (${Date.now() - t}ms)`)
    } catch (e) { console.log(`${code}: FAIL ${e.message}`) }
  }
  const d = await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_CATALOG&code=JYML-2026-09-0001`, { headers: H })).json()
  console.log('目录单明细行 =', (d?.data?.detailData?.items || []).length)
}
main().catch(e => console.log('FATAL', e.message))
