/**
 * _chk-filtereff-head.cjs — 查 RD_FILTER_EFF 的头表/分组列,定位必填校验为何没拦
 * 用法:node tools/archive/_chk-filtereff-head.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

console.log('=== yj_panel 列名 ===')
console.log(s(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id`).split(/\r?\n/).join(', '))

console.log('')
console.log('=== yj_panel 里 RD_FILTER_EFF 的关键列(逐列打印前 6 列) ===')
const cols = s(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id`).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
console.log('  列 =', cols.join(', '))

// 找出承载"表名"的列
for (const c of cols) {
  if (!/table|head|line|group|code|name/i.test(c)) continue
  const v = s(`SELECT TOP 1 ISNULL(CONVERT(varchar(200), [${c}]),'(null)') FROM yj_panel WHERE panel_code='RD_FILTER_EFF'`)
  console.log(`  ${c} = ${v}`)
}

console.log('')
console.log('=== 该面板的必填字段(col_name / label) ===')
console.log(s(`SELECT place+' | '+col_name+' | label='+label+' | req='+CAST(required AS varchar)
  FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND required=1 ORDER BY place, seq`))
