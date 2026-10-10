/**
 * 一次性探针(2026-10-15):验证「销售出库单从销售订单生单/选单时,带出销售订单号与销售订单行号」。
 *
 * 断言口径(逐条对应需求):
 *   ① SALE_OUT 面板配置里,表头有可见列「销售订单号」;
 *   ② 明细有可见列「销售订单行号」(物理列 源单行号);
 *   ③ SO_ORDER → SALE_OUT 的头映射含 {单据编号 → 销售订单号}(缺则生单后订单号为空);
 *   ④ 行映射含 {行号 → 销售订单行号}(缺则生单后行号为空);
 *   ⑤ 选单弹窗(selectConfig)来源 = SO_ORDER 且可用。
 *
 * 用法: node tools/archive/_probe-saleout-order-carry-1015.mjs [apiBase]
 */
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '') + '/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(path + ' 非 JSON(HTTP ' + r.status + '): ' + t.slice(0, 200)) }
}

/** getPanelConfig 是 **GET + query param**(见 PxController:431),不是 POST body */
async function apiGet(path, token) {
  const r = await fetch(base + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(path + ' 非 JSON(HTTP ' + r.status + '): ' + t.slice(0, 200)) }
}

const lg = await api('/auth/login', { userName: 'admin', password: '123456' })
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const results = []
let pass = 0, total = 0
const check = (label, ok, detail) => {
  total++
  if (ok) pass++
  results.push({ label, ok, detail: detail || '' })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' — ' + detail : ''}`)
}

// 面板配置:表头/明细可见列
const cfgRes = await apiGet('/px/getPanelConfig?panelCode=SALE_OUT', token)
const cfg = cfgRes?.data || cfgRes
const headLabels = (cfg?.detail?.tabs?.[0]?.fields || cfg?.headerFields || []).map((f) => f.label || f.dataName)
// 表头字段另有一份(作兜底:两种结构都看)
const dataFields = (cfg?.dataSchema?.fields || []).map((f) => f.label || f.dataName)
const allLabels = new Set([...headLabels, ...dataFields])

check('表头可查询/可见列含「销售订单号」', allLabels.has('销售订单号'),
  allLabels.has('销售订单号') ? '' : '实际:' + [...allLabels].slice(0, 12).join(','))

const detailLabels = (cfg?.detail?.tabs || []).flatMap((t) => (t.fields || []).map((f) => f.label || f.dataName))
check('明细可见列含「销售订单行号」', detailLabels.includes('销售订单行号'),
  detailLabels.includes('销售订单行号') ? '' : '实际:' + detailLabels.join(','))
check('明细可见列含「源单编号」', detailLabels.includes('源单编号'), '')

// 选单配置:来源 + 头/行映射
const sc = cfg?.selectConfig || {}
check('选单来源 = SO_ORDER', sc.source === 'SO_ORDER', '实际 source=' + sc.source)
const hmap = sc.headerMap || []
const dmap = sc.detailMap || []
const hHit = hmap.some((m) => m.to === '销售订单号' && m.from === '单据编号')
const dHit = dmap.some((m) => m.to === '销售订单行号')
check('头映射含 {单据编号 → 销售订单号}', hHit, JSON.stringify(hmap))
check('行映射含 {行号 → 销售订单行号}', dHit, JSON.stringify(dmap))

console.log(`\n结果: ${pass}/${total}`)
console.log('JSON:' + JSON.stringify(results))
process.exit(pass === total ? 0 : 1)
