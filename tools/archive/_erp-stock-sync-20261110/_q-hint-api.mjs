/**
 * _q-hint-api.mjs — 接口级实证:审核返回体是否带「库存提示」(2026-11-10「库存以金蝶为准」的提示码)
 *
 * 为什么用接口而不是点界面:界面上那张单的工具栏是自定义下拉,自动点击打不开;
 * 这里只验**契约**(后端返回 `库存提示` 字段 + 值),界面气泡由 stockHint 单测覆盖。
 *
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-hint-api.mjs [TEST|PROD] [单据编号]
 *   · TEST = 测试账套(HSDZ_MES_TEST),默认;PROD 会动正式数据,**不要随便跑**
 *   · 跑完自动尝试「弃审」把单据还原(失败只提示,不影响结论)
 */
const base = 'http://127.0.0.1:8090/api'
const factory = process.argv[2] || 'YJ_TEST'
const docNo = process.argv[3] || 'PI-2026-10-0104'

const post = async (path, body, token) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const login = await post('/auth/login', { userName: 'admin', password: '123456', factory })
const token = login.json?.data?.token || login.json?.data?.payload?.token
console.log(`登录: HTTP ${login.status} token=${token ? 'OK' : '缺失'}`)
if (!token) { console.log(JSON.stringify(login.json).slice(0, 300)); process.exit(1) }

// 先看单据现状
const before = await post('/px/callButton', { panelCode: 'PURCHASE_IN', buttonName: '修改记录', formData: { 编号: docNo }, buttonParam: {} }, token)
console.log(`审核前调用(修改记录): HTTP ${before.status}`)

const audit = await post('/px/callButton', { panelCode: 'PURCHASE_IN', buttonName: '审核', formData: { 编号: docNo, 审核意见: '库存口径提示取证' }, buttonParam: {} }, token)
const data = audit.json?.data || {}
console.log(`审核: HTTP ${audit.status}`)
if (audit.status !== 200) console.log('错误体:', JSON.stringify(audit.json).slice(0, 500))
console.log('返回体:', JSON.stringify(data).slice(0, 400))
console.log('检查:')
console.log('  · 单据状态 =', data['单据状态'])
console.log('  · 库存提示 =', data['库存提示'])
console.log(data['库存提示'] === '待转ERP'
  ? '  ⇒ PASS:采购入库审核返回「待转ERP」提示码(前端据此弹「需转ERP+金蝶审核」)'
  : '  ⇒ FAIL:没有拿到预期的 库存提示')

// 还原:弃审
const un = await post('/px/callButton', { panelCode: 'PURCHASE_IN', buttonName: '弃审', formData: { 编号: docNo }, buttonParam: {} }, token)
console.log(`弃审还原: HTTP ${un.status} ${un.json?.message || ''}`)
process.exitCode = data['库存提示'] === '待转ERP' ? 0 : 1
