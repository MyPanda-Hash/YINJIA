// 合并后冒烟:本地功能(库存报表/质检)+ 远端功能(研发面板/两级审批/两账套)在合并 jar + 同步库上的存活验证
const BASE = 'http://localhost:8090/api'
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const post = async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data
const get = async (p) => (await (await fetch(BASE + p, { headers: H })).json()).data

// ── 本地侧 ──
const plain = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {} })
const filt = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {}, advFilters: [{ field: '存货', op: 'contains', value: '端盖' }] })
ok('① 库存台账 advFilters 服务端化(本地)', filt.totalSize < plain.totalSize, `${plain.totalSize} → ${filt.totalSize}`)
const recalc = await post('/px/callButton', { panelCode: 'STOCK_BALANCE', buttonName: '重算成本', formData: {}, buttonParam: {} })
ok('② 重算成本(本地)', recalc?.['重算行数'] > 0, `重算 ${recalc?.['重算行数']} 行`)
for (const code of ['QC_CATALOG', 'QC_INSP_REC', 'QC_INSP', 'QC_RECV']) {  // QC_RECV=暂收单(panel-merge-qc 后本地终态码,表仍 sl_recv*)
  const cfg = await get(`/px/getPanelConfig?panelCode=${code}`)
  ok(`③ 质检链面板 ${code}(本地)`, !!cfg?.metadata?.panelName, cfg?.metadata?.panelName)
}
const recvList = await post('/px/queryFormDataList', { panelCode: 'QC_RECV', pageNo: 1, pageSize: 5, condition: {} })
ok('③b 暂收单列表可查(188 张存量)', recvList?.totalSize > 0, `${recvList?.totalSize} 张`)
// ── 远端侧 ──
for (const code of ['RD_PROD_INFO', 'RD_PROGRESS', 'RD_CHANGE', 'RD_PROD_DOCLIST', 'RD_SAMPLE_NO']) {
  const cfg = await get(`/px/getPanelConfig?panelCode=${code}`)
  ok(`④ 研发面板 ${code}(远端)`, !!cfg?.metadata?.panelName, cfg?.metadata?.panelName)
}
// 两级审批:RD_PROD_INFO 单据列表状态推导列(approve_node 路径存活)
const rd = await post('/px/queryFormDataList', { panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 5, condition: {} })
ok('⑤ 产品信息表列表可查(两级审批状态推导)', Array.isArray(rd?.list), `${rd?.totalSize ?? '?'} 张`)
// 单据状态推导存活(QC_INSP 走 docStatus:erp_close_state+approve_node 并集列)
const qc = await post('/px/queryFormDataList', { panelCode: 'QC_INSP', pageNo: 1, pageSize: 5, condition: {} })
ok('⑥ 来料检验单列表(状态推导并集列)', Array.isArray(qc?.list), `${qc?.totalSize ?? '?'} 张`)
