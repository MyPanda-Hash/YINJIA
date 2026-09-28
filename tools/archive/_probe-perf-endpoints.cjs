/* 关键接口延迟实测:面板配置/列表查询/看板/审批历史,各 3 轮取均值 */
const base = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function timed(label, fn, runs = 3) {
  const ts = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    try { const r = await fn(); if (i === 0) ts.tag = r } catch (e) { ts.tag = 'ERR ' + e.message }
    ts.push(performance.now() - t0)
    await sleep(150)
  }
  const avg = (ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(0)
  console.log(`${avg.padStart(6)}ms  ${label}   [${ts.map(t => t.toFixed(0)).join(', ')}] ${typeof ts.tag === 'number' ? 'rows=' + ts.tag : ''}`)
}
async function main() {
  const t0 = performance.now()
  const l = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await l.json()
  console.log(`login: ${(performance.now() - t0).toFixed(0)}ms`)
  const token = login.data.token
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const get = (p) => async () => { const r = await fetch(base + p, { headers: H }); await r.json(); return r.status }
  const post = (p, b) => async () => { const r = await fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(b) }); const j = await r.json(); return j?.data?.list?.length ?? j?.data?.totalSize ?? r.status }

  await timed('getPanelConfig SO_ORDER(大头行单据)', get('/api/px/getPanelConfig?panelCode=SO_ORDER'))
  await timed('getPanelConfig PARTNER(档案)', get('/api/px/getPanelConfig?panelCode=PARTNER'))
  await timed('getPanelConfig MANU_ORDER', get('/api/px/getPanelConfig?panelCode=MANU_ORDER'))
  await timed('queryFormDataList SO_ORDER p1', post('/api/px/queryFormDataList', { panelCode: 'SO_ORDER', pageNo: 1, pageSize: 20 }))
  await timed('queryFormDataList PARTNER p1', post('/api/px/queryFormDataList', { panelCode: 'PARTNER', pageNo: 1, pageSize: 20 }))
  await timed('queryFormDataList STOCK_STATUS(报表视图)', post('/api/px/queryFormDataList', { panelCode: 'STOCK_STATUS', pageNo: 1, pageSize: 20 }))
  await timed('queryFormDataList SO_ORDER 条件LIKE', post('/api/px/queryFormDataList', { panelCode: 'SO_ORDER', pageNo: 1, pageSize: 20, condition: { 客户名: 'a' } }))
  await timed('rdDev/board(研发看板)', get('/api/px/rdDev/board'))
  await timed('getFormDescriptor SO_ORDER 首单', get('/api/px/getFormDescriptor?panelCode=SO_ORDER&code=' + encodeURIComponent('SO-2026-08-0001')))
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
