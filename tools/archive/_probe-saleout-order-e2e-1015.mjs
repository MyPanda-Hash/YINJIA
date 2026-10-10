/**
 * 端到端实测(2026-10-15):销售订单 →(生单)销售出库单,验证**销售订单号 / 销售订单行号**真的落值。
 *
 * 为什么必须端到端:"配置里有映射" ≠ "生单后值进得去"。映射失配(标签对不上物理列、
 *   目标字段没登记)时,保存会**静默忽略**该列 —— 只有真造一张单、回读库里这两列才算数。
 *
 * 口径(与用户需求逐条对应):
 *   ① 选一张已审核且有「行号」的销售订单;
 *   ② 通过 callButton「生成销售出库单」生单;
 *   ③ 回读新单:表头「销售订单号」== 源订单号;明细「销售订单行号」== 源行行号;
 *   ④ 清理:删掉本次生成的测试单(只删自己造的,按单号精确删)。
 *
 * 用法: node tools/archive/_probe-saleout-order-e2e-1015.mjs [apiBase] [--keep]
 *   --keep 保留生成的单据(排查用);默认删掉,保证不污染正式账。
 */
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '') + '/api'
const KEEP = process.argv.includes('--keep')

async function api(path, body, token, method = 'POST') {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(path + ' 非 JSON(HTTP ' + r.status + '): ' + t.slice(0, 300)) }
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

// ---- ① 取一张已审核、明细有行号的销售订单 ----
const q = await api('/px/queryFormDataList', { panelCode: 'SO_ORDER', condition: {}, pageNo: 1, pageSize: 50 }, token)
const docs = (q?.data?.list || q?.list || []).filter((d) => String(d['单据状态']) === '已审核')
let src = null, srcItem = null
for (const d of docs) {
  const detail = d['detail'] || {}
  const items = detail['items'] || detail[Object.keys(detail)[0]] || []
  const hit = (Array.isArray(items) ? items : []).find((it) => String(it['行号'] ?? '').trim() !== '')
  if (hit) { src = d; srcItem = hit; break }
}
if (!src) { console.error('[FATAL] 没有可用于实测的已审核销售订单(需明细有行号)'); process.exit(1) }
const srcNo = String(src['单据编号'] || src['编号'])
const srcLine = String(srcItem['行号'])
console.log(`[准备] 源销售订单 ${srcNo} · 行号 ${srcLine} · 存货 ${srcItem['存货名称'] || ''}\n`)

// ---- ② 生单:生成销售出库单 ----
// ⚠ 契约(2026-10-15 实测):生单按钮读的是 formData.**编号**(内部键),送「单据编号」会被
//   ButtonService 判「缺少表单编号」直接 400。列表页行同时有 编号/单据编号两个键,取 编号。
let newNo = ''
try {
  const res = await api('/px/callButton', {
    panelCode: 'SO_ORDER', buttonName: '生成销售出库单',
    formData: { 编号: srcNo, 单据编号: srcNo }, buttonParam: {},
  }, token)
  newNo = String(res?.data?.['编号'] || res?.data?.newNo || res?.data?.['单据编号'] || '')
  check('生单接口返回新单号', !!newNo, `返回 ${JSON.stringify(res?.data).slice(0, 200)}`)
} catch (e) {
  check('生单接口调用成功', false, String(e.message).slice(0, 300))
}

if (!newNo) {
  console.log('\n生单未返回单号,无法继续回读。结果:', `${pass}/${total}`)
  console.log('JSON:' + JSON.stringify(results))
  process.exit(1)
}

// ---- ③ 回读新单,验证两列 ----
const q2 = await api('/px/queryFormDataList', { panelCode: 'SALE_OUT', condition: { keyword: newNo }, pageNo: 1, pageSize: 20 }, token)
let outs = q2?.data?.list || q2?.list || []
let outDoc = outs.find((d) => String(d['单据编号'] || d['编号']) === newNo) || outs[0]
if (!outDoc) {
  // 兜底:按全量翻找
  const q3 = await api('/px/queryFormDataList', { panelCode: 'SALE_OUT', condition: {}, pageNo: 1, pageSize: 200 }, token)
  outs = q3?.data?.list || q3?.list || []
  outDoc = outs.find((d) => String(d['单据编号'] || d['编号']) === newNo)
}
check('新单可在销售出库单面板查到', !!outDoc, newNo)

const headOrderNo = outDoc ? String(outDoc['销售订单号'] ?? '') : ''
check('表头「销售订单号」== 源订单号', headOrderNo.trim() === srcNo, `读到「${headOrderNo}」,期望「${srcNo}」`)

const od = outDoc?.['detail'] || {}
const outItems = od['items'] || od[Object.keys(od)[0]] || []
const lineVals = (Array.isArray(outItems) ? outItems : []).map((it) => String(it['销售订单行号'] ?? ''))
check('明细「销售订单行号」含源行号', lineVals.includes(srcLine),
  `读到 ${JSON.stringify(lineVals)},期望含「${srcLine}」`)

console.log(`\n生成单号: ${newNo}`)

// ---- ④ 清理 ----
if (!KEEP) {
  try {
    await api('/px/deleteForms', { panelCode: 'SALE_OUT', rowCodes: [newNo] }, token)
    console.log(`[清理] 已删除测试单 ${newNo}`)
  } catch (e) {
    console.log(`[清理] 删除失败(请手工删 ${newNo}): ${String(e.message).slice(0, 200)}`)
  }
} else {
  console.log(`[保留] --keep 指定,测试单 ${newNo} 未删除`)
}

console.log(`\n结果: ${pass}/${total}`)
console.log('JSON:' + JSON.stringify(results))
process.exit(pass === total ? 0 : 1)
