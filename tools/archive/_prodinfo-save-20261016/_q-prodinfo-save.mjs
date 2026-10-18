/**
 * _q-prodinfo-save.mjs — 「产品信息表」保存丢字段取证(只读)
 * 用法: node tools/archive/_prodinfo-save-20261016/_q-prodinfo-save.mjs [baseUrl] [docNo]
 */
const BASE = (process.argv[2] || 'http://36.140.66.163:8090').replace(/\/$/, '') + '/api'
const DOC = process.argv[3] || 'PI-2026-10-0007'
const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(b || {}),
})).json())
const get = async (p, token) => (await (await fetch(BASE + p, { headers: { Authorization: 'Bearer ' + token } })).json())
const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 120)); process.exit(1) }
const token = lg.data.token
console.log('== ' + BASE + ' ==')

// ① 该单的实际存值
const q = await post('/px/queryFormDataList', { panelCode: 'RD_PROD_INFO', condition: { 单据编号: DOC }, pageNo: 1, pageSize: 3 }, token)
const row = (q.data?.list || [])[0]
console.log(`\n-- ${DOC} 状态=${row?.['单据状态'] ?? '(无此单)'} --`)
const WANT = ['单据编号', '产品编号', '产品名称', '主要性能描述', '产品主要性能', '审核人（一级审批人）', '审核人（二级审批人）', '产品负责人', '备注', '客户图纸或规格书']
if (row) for (const k of WANT) console.log(`   ${k.padEnd(22)} = ${JSON.stringify(row[k] ?? null)}`)
else console.log('   本地/该库查不到这一单')

// ①b 该单**实际带回来的全部键**(= 服务器注册的字段集),把含「性能/审批/负责」的挑出来
if (row) {
  const keys = Object.keys(row).filter((k) => k !== 'detail')
  console.log(`\n-- 该单返回键 ${keys.length} 个;含「性能/审批/负责/描述」的 --`)
  for (const k of keys) if (/性能|审批|负责|描述/.test(k)) console.log(`   ${k.padEnd(24)} = ${JSON.stringify(row[k])}`)
}

// ② 面板里这些字段的定义(是否可编辑/参照)
const cfg = await get('/px/getPanelConfig?panelCode=RD_PROD_INFO', token)
const fields = (cfg?.data?.metadata?.panelPageDto?.tablePages?.[0]?.formFields || cfg?.data?.metadata?.fields || [])
console.log(`\n-- RD_PROD_INFO 字段数 ${fields.length}(只看关心的) --`)
for (const f of fields) {
  const n = String(f.dataName || f.label || '')
  if (WANT.some((w) => n.includes(w.replace('（一级审批人）', '').replace('（二级审批人）', '')) )) {
    console.log(`   ${n.padEnd(22)} editable=${f.editable ?? '-'} visible=${f.visible ?? '-'} hidden=${f.hidden ?? '-'} ref=${f.refPanel ?? '-'}`)
  }
}
