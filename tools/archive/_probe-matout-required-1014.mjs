/**
 * 一次性探针(2026-10-14):复现「材料出库单(MATERIAL_OUT)」两条报错的**来源层**。
 *   ① 选商品(明细参照确认)时前端会顺带发一次「保存」(= API buttonName '提交') ⇒ 后端必填校验;
 *   ② 表头必填缺失时同一次保存也会报「XXX不能为空」。
 * 全程**只发必然失败(缺必填)的保存**,不落任何库改动。
 * 用法: node tools/archive/_probe-matout-required-1014.mjs [--api http://127.0.0.1:8090/api]
 */
const API = (() => {
  const i = process.argv.indexOf('--api')
  return i >= 0 ? process.argv[i + 1] : 'http://127.0.0.1:8090/api'
})()

async function post(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: res.status, json, text }
}

async function get(path, token) {
  const res = await fetch(API + path, {
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const login = await post('/auth/login', { userName: 'admin', password: '123456' })
const token = login.json?.data?.token
if (!token) {
  console.error('[FATAL] 登录失败:', login.status, login.text.slice(0, 300))
  process.exit(1)
}
console.log('[login] ok  token 长度 =', token.length)

// ---------- 1. 面板配置(前端拿到的那一份) ----------
const cfgRes = await get('/px/getPanelConfig?panelCode=MATERIAL_OUT', token)
const cfg = cfgRes.json?.data || cfgRes.json
const headReq = (cfg?.dataSchema?.fields || []).filter((f) => f.isRequired && !f.hidden).map((f) => f.dataName)
const detailReq = []
for (const t of cfg?.detail?.tabs || []) {
  for (const f of t.fields || []) if (f.isRequired) detailReq.push(`${t.key}/${f.dataName}`)
}
console.log('\n[config] HTTP', cfgRes.status)
console.log('[config] 表头可见必填 =', JSON.stringify(headReq))
console.log('[config] 明细必填     =', JSON.stringify(detailReq))
console.log('[config] 明细页签     =', (cfg?.detail?.tabs || []).map((t) => `${t.key}(${t.label})`).join(', '))

// ---------- 2. 找一张 MATERIAL_OUT 草稿(只读) ----------
const listRes = await post('/px/queryFormDataList', { panelCode: 'MATERIAL_OUT', condition: {}, pageNo: 1, pageSize: 5 }, token)
const rows = listRes.json?.data?.list || listRes.json?.list || []
console.log('\n[list] HTTP', listRes.status, '行数 =', rows.length)
const draft = rows.find((r) => r['单据状态'] === '草稿') || rows[0]
if (!draft) {
  console.error('[FATAL] 没有可用的 MATERIAL_OUT 单据,无法继续')
  process.exit(2)
}
console.log('[list] 取单据 =', draft['编号'], '| 状态 =', draft['单据状态'], '| 业务类型 =', draft['业务类型'], '| 仓库 =', draft['仓库'])

// ---------- 3. 复现「明细第 N 行批号不能为空」 ----------
const head = {
  编号: draft['编号'],
  单据日期: draft['单据日期'] || '2026-10-07',
  业务类型: draft['业务类型'] || '销售出库',
  仓库: draft['仓库'] || '',
  加工单号: draft['加工单号'] || '',
}
const rowMissingBatch = {
  材料编码: 'PROBE-NOT-SAVED', 批号: '', 材料名称: '探针物料', 计量单位: '个', 数量: 1, 单价: 1, 金额: 1,
}
const r1 = await post('/px/callButton', {
  panelCode: 'MATERIAL_OUT', buttonName: '提交',
  formData: { ...head, detail: { items: [rowMissingBatch] } }, buttonParam: {},
}, token)
console.log('\n[复现①·明细缺批号] HTTP', r1.status, '=>', JSON.stringify(r1.json?.message || r1.json))

// ---------- 4. 复现「表头未填写」(业务类型留空) ----------
const r2 = await post('/px/callButton', {
  panelCode: 'MATERIAL_OUT', buttonName: '提交',
  formData: { ...head, 业务类型: '', detail: { items: [{ ...rowMissingBatch, 批号: 'PROBE-LOT' }] } }, buttonParam: {},
}, token)
console.log('[复现②·表头缺业务类型] HTTP', r2.status, '=>', JSON.stringify(r2.json?.message || r2.json))
