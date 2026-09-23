const BASE = 'http://localhost:8090/api'
async function timed(label, fn) {
  const t = Date.now()
  try { const r = await fn(); console.log(`${label}: OK ${Date.now() - t}ms ${r || ''}`) }
  catch (e) { console.log(`${label}: FAIL ${Date.now() - t}ms ${e.message}`) }
}
async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const H = { Authorization: `Bearer ${login.data.token}` }
  const J = { ...H, 'Content-Type': 'application/json' }
  await timed('getPanelConfig QC_CATALOG', async () => (await (await fetch(`${BASE}/px/getPanelConfig?panelCode=QC_CATALOG`, { headers: H })).json())?.data?.metadata?.panelName)
  await timed('getPanelConfig QC_INSP_REC', async () => (await (await fetch(`${BASE}/px/getPanelConfig?panelCode=QC_INSP_REC`, { headers: H })).json())?.data?.metadata?.panelName)
  await timed('queryFormDataList QC_CATALOG', async () => ((await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'QC_CATALOG', pageNo: 1, pageSize: 20, condition: {} }) })).json())?.data?.list || []).length + ' 张')
  await timed('getFormDescriptor QC_CATALOG', async () => ((await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_CATALOG&code=JYML-2026-09-0001`, { headers: H })).json())?.data?.detailData?.items || []).length + ' 行')
  await timed('queryFormDataList QC_RECV', async () => ((await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'QC_RECV', pageNo: 1, pageSize: 20, condition: {} }) })).json())?.data?.list || []).length + ' 张')
  await timed('queryArchive QC_INSP_REQ', async () => JSON.stringify((await (await fetch(`${BASE}/px/queryArchive`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'QC_INSP_REQ' }) })).json())?.data ? 'OK' : 'empty'))
  await timed('queryFormDataList STOCK_LEDGER', async () => ((await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 20, condition: {} }) })).json())?.data?.list || []).length + ' 行')
  await timed('queryFormDataList STOCK_BALANCE', async () => ((await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'STOCK_BALANCE', pageNo: 1, pageSize: 20, condition: {} }) })).json())?.data?.list || []).length + ' 行')
  await timed('queryFormDataList PURCHASE_IN', async () => ((await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: J, body: JSON.stringify({ panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 20, condition: {} }) })).json())?.data?.list || []).length + ' 张')
}
main().catch(e => console.log('FATAL', e.message))
