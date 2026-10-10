// 一次性探针(2026-10-15):三出库面板左栏「单据选择」配置的接口级验证。
// 口径:左栏中间列由前端 DOC_RAIL_PANELS 决定(前端常量,不在接口里),
//       故本探针验证「接口确实能提供该中间列的数据」——即 rows 里该键有值,否则左栏会渲染空白列。
// 用法: node tools/archive/_probe-3out-rail-api.mjs [baseUrl]
// 用法: node tools/archive/_probe-3out-rail-api.mjs [host]
// 注:后端接口一律带 /api 前缀(/auth/login、/px/queryFormDataList);不带前缀会被 Spring Security 判 403。
const host = process.argv[2] || 'http://127.0.0.1:8090'
const base = host.replace(/\/+$/, '') + '/api'
const PANELS = { SALE_OUT: '客户', MATERIAL_OUT: '生产车间', FINISH_IN: '加工单号' }

async function api(path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(path + ' 非 JSON(HTTP ' + r.status + '): ' + t.slice(0, 200)) }
}

const lg = await api('/auth/login', { userName: 'admin', password: '123456' })
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败:', JSON.stringify(lg).slice(0, 200)); process.exit(1) }
console.log('[login] ok, token 长度 =', token.length)

let pass = 0, total = 0
const results = []
for (const [code, col] of Object.entries(PANELS)) {
  total++
  try {
    const res = await api('/px/queryFormDataList', { panelCode: code, condition: {}, pageNo: 1, pageSize: 50 }, token)
    const list = res?.data?.list || res?.list || []
    const nz = list.filter((r) => r[col] !== undefined && r[col] !== null && String(r[col]).trim() !== '').length
    // 左栏还要用 单号/日期/单据状态 三列(由 docRailCfg 兜底组装),一并核
    const noNz = list.filter((r) => String(r['编号'] || r['单据编号'] || '').trim() !== '').length
    const stNz = list.filter((r) => String(r['单据状态'] ?? '').trim() !== '').length
    const ok = list.length > 0 && nz > 0 && noNz > 0 && stNz > 0
    results.push({ code, col, rows: list.length, filled: nz, noFilled: noNz, statusFilled: stNz, ok })
    if (ok) pass++
    console.log(`${ok ? '[PASS]' : '[FAIL]'} ${code}: 本页 ${list.length} 行 | 单号 ${noNz} | 「${col}」 ${nz} | 状态 ${stNz}`)
  } catch (e) {
    results.push({ code, col, error: String(e.message).slice(0, 200), ok: false })
    console.log(`[FAIL] ${code}: ${String(e.message).slice(0, 200)}`)
  }
}
console.log(`\n结果: ${pass}/${total}`)
console.log(JSON.stringify(results, null, 2))
process.exit(pass === total ? 0 : 1)

