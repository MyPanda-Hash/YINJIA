/**
 * _chk-required-raw.cjs — 对比 RD_FILTER_EFF 与 RD_SOAK 的 required 原始存储值
 * 目的:排除 char(2)/尾空格/类型差异导致后端 required() 读成 false
 * 用法:node tools/archive/_chk-required-raw.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

console.log('=== yj_field.required / place 列类型 ===')
console.log(s(`SELECT c.name, t.name AS type, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
  WHERE c.object_id=OBJECT_ID('yj_field') AND c.name IN ('required','place','seq','col_name','label','display_name')`))

console.log('')
console.log('=== RD_FILTER_EFF header 字段原始值(place 是逗号复合值,用 LIKE)===')
console.log(s(`SELECT panel_code+'|'+place+'|'+col_name+'|'+label+'|req=['+required+']|len='+CAST(LEN(required) AS varchar)+'|seq='+CAST(seq AS varchar)
  FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND place LIKE '%header%' ORDER BY seq`))

console.log('')
console.log('=== RD_SOAK header 字段原始值(对照组)===')
console.log(s(`SELECT panel_code+'|'+place+'|'+col_name+'|'+label+'|req=['+required+']|len='+CAST(LEN(required) AS varchar)+'|seq='+CAST(seq AS varchar)
  FROM yj_field WHERE panel_code='RD_SOAK' AND place LIKE '%header%' ORDER BY seq`))

console.log('')
console.log('=== 两面板 place 取值分布 ===')
console.log(s(`SELECT panel_code, '['+place+']' AS place_raw, COUNT(*) AS n FROM yj_field
  WHERE panel_code IN ('RD_FILTER_EFF','RD_SOAK') GROUP BY panel_code, place ORDER BY panel_code`))
