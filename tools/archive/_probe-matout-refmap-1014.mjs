/**
 * 一次性探针(2026-10-14):打印 MATERIAL_OUT 明细字段的参照映射(refMap),
 * 确认「选材料编码」会带入哪些列(材料名称/计量单位 是否自动带出),用于说明"选商品那一刻还缺什么"。
 * 用法: node tools/archive/_probe-matout-refmap-1014.mjs
 */
const API = 'http://127.0.0.1:8090/api'
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const cfg = (await (await fetch(`${API}/px/getPanelConfig?panelCode=MATERIAL_OUT`, {
  headers: { Authorization: 'Bearer ' + token },
})).json())
const c = cfg?.data || cfg
for (const t of c?.detail?.tabs || []) {
  console.log(`\n=== 明细页签 ${t.key} (${t.label}) 字段 ${t.fields.length} ===`)
  for (const f of t.fields) {
    const ref = f.ref || {}
    console.log(`  · ${f.dataName} | type=${f.dataType} | required=${!!f.isRequired} | refPanel=${f.refPanel || ref.panel || ''} | refField=${f.refField || ref.field || ''} | refMap=${JSON.stringify(f.refMap || f.map || [])}`)
  }
}
console.log('\n=== 表头字段(前 6) ===')
for (const f of (c?.dataSchema?.fields || []).slice(0, 6)) console.log('  ·', JSON.stringify(f))
