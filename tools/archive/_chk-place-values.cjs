/**
 * _chk-place-values.cjs — yj_field.place 取值盘点
 * 背景:后端 inPlace(p) 用 place.contains(p),即 place 可能是 'header,xxx' 复合值;
 * 探针里用 place='header' 精确匹配会漏掉这些字段,导致"表头无必填"的错误筛选。
 * 用法:node tools/archive/_chk-place-values.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

console.log('=== place 取值分布 ===')
console.log(s(`SELECT '['+place+'] | n='+CAST(COUNT(*) AS varchar) AS v FROM yj_field GROUP BY place ORDER BY COUNT(*) DESC`))

console.log('')
console.log("=== 精确='header' 与 LIKE '%header%' 的差异 ===")
console.log(s(`SELECT 'exact=' + CAST(SUM(CASE WHEN place='header' THEN 1 ELSE 0 END) AS varchar)
  + ' like=' + CAST(SUM(CASE WHEN place LIKE '%header%' THEN 1 ELSE 0 END) AS varchar) FROM yj_field`))

console.log('')
console.log('=== CKD / RKD 的 required 字段 place ===')
console.log(s(`SELECT panel_code+' | '+col_name+' | ['+place+']' FROM yj_field WHERE panel_code IN ('CKD','RKD') AND required=1 ORDER BY panel_code, seq`))
