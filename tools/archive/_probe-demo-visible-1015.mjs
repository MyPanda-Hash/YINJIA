/**
 * 探针(2026-10-15):确认「测试账套登录后,报工记录面板能看到演示数据」。
 * 为什么需要:演示数据只造在 HSDZ_MES_TEST(用户口径:不污染正式账),
 *   而截图必须反映**真实可见**的界面 —— 先证明这条路通,再去截图。
 * 只读。用法: node tools/archive/_probe-demo-visible-1015.mjs [host]
 */
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '') + '/api'

// 测试账套:登录时带 factory=YJ_TEST(DataSourceRouter.TEST),之后所有请求走测试库
const lg = await (await fetch(base + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = lg?.data?.token
console.log('登录 code =', lg?.code, '| factory =', lg?.data?.factory, '| token?', !!token)
if (!token) { console.error('登录失败:', JSON.stringify(lg).slice(0, 200)); process.exit(1) }

async function q(panelCode, pageSize = 50) {
  const r = await fetch(base + '/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize }),
  })
  return await r.json()
}

const rep = await q('WO_REPORT_LIST')
const list = rep?.data?.list || []
console.log('报工记录 totalSize =', rep?.data?.totalSize, '| 本页', list.length, '行')
if (list[0]) console.log('首行 =', JSON.stringify({
  单据编号: list[0]['单据编号'], 工单号: list[0]['工单号'], 工序: list[0]['工序'],
  报工数量: list[0]['报工数量'], 生产线: list[0]['生产线'], 报工人: list[0]['报工人'],
}))

// 对照:正式账套应仍为空(证明没污染)
const lg2 = await (await fetch(base + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const t2 = lg2?.data?.token
const r2 = await fetch(base + '/px/queryFormDataList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t2 },
  body: JSON.stringify({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 5 }),
})
const d2 = await r2.json()
console.log('(对照)正式账套 报工记录 totalSize =', d2?.data?.totalSize, '  ← 应为 0,证明未污染正式库')

const ok = (rep?.data?.totalSize || 0) >= 7 && (d2?.data?.totalSize || 0) === 0
console.log(ok ? '\n[PASS] 测试账套可见 7 行演示数据,正式账套仍为空' : '\n[FAIL] 与预期不符')
process.exit(ok ? 0 : 1)
