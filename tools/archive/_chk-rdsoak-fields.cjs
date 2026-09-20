/**
 * _chk-rdsoak-fields.cjs — 看 RD_SOAK 头部字段的 place/required 实际值,定位必填校验为何没生效
 * 用法:node tools/archive/_chk-rdsoak-fields.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

console.log('=== RD_SOAK place 含 header 的字段(place 是逗号复合值,用 LIKE)===')
console.log(sql(`SELECT place+' | '+col_name+' | label='+label+' | req='+CAST(required AS varchar)+' | editable='+CAST(editable AS varchar)
  FROM yj_field WHERE panel_code='RD_SOAK' AND place LIKE '%header%' ORDER BY seq`))

console.log('')
console.log('=== RD_SOAK 全部字段的 place 取值(去重) ===')
console.log(sql(`SELECT place+' x'+CAST(COUNT(*) AS varchar) FROM yj_field WHERE panel_code='RD_SOAK' GROUP BY place`))

console.log('')
console.log('=== 接口下发的字段(确认后端拿到的 required/place)===')
;(async () => {
  const lg = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const tk = lg.data ? lg.data.token : lg.token
  const r = await fetch('http://127.0.0.1:8090/api/px/getPanelConfig?panelCode=RD_SOAK', { headers: { Authorization: 'Bearer ' + tk } })
  const j = await r.json()
  const fields = (j.data && j.data.dataSchema && j.data.dataSchema.fields) || []
  console.log('  dataSchema.fields 数 =', fields.length)
  fields.forEach((f) => console.log(`    ${f.dataName}  type=${f.dataType} required=${f.isRequired} hidden=${f.hidden}`))
})()
