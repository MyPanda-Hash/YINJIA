/**
 * _chk-hidden-required.cjs — 必填且隐藏的表头字段(会被后端强校验、前端看不见)
 * 后端 ensureRequiredFilled 用 fieldsAt('header')(= place 含 header),**不滤 hidden**;
 * 前端 validateInlineDraft 用 dataSchema.fields.filter(!hidden) ⇒ 两者口径可能不一致。
 * 用法:node tools/archive/_chk-hidden-required.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

const SYS = `N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期'`
console.log('=== 表头必填 + hidden=1 的字段(后端会要求、前端不显示)===')
console.log(s(`SELECT panel_code+' | '+label+' | hidden='+CAST(hidden AS varchar)+' | visible='+CAST(visible AS varchar)+' | col='+col_name
  FROM yj_field WHERE place LIKE '%header%' AND required=1 AND hidden=1 AND col_name NOT IN (${SYS})
  ORDER BY panel_code, seq`))

console.log('')
console.log('=== 明细必填 + hidden=1 ===')
console.log(s(`SELECT panel_code+' | '+label+' | hidden='+CAST(hidden AS varchar)+' | visible='+CAST(visible AS varchar)+' | col='+col_name
  FROM yj_field WHERE place LIKE '%detail%' AND required=1 AND hidden=1 AND col_name NOT IN (${SYS})
  ORDER BY panel_code, seq`))

console.log('')
console.log('=== 计数对照 ===')
console.log(s(`SELECT '表头必填总数=' + CAST(SUM(CASE WHEN place LIKE '%header%' AND required=1 AND col_name NOT IN (${SYS}) THEN 1 ELSE 0 END) AS varchar)
  + ' 其中 hidden=1:' + CAST(SUM(CASE WHEN place LIKE '%header%' AND required=1 AND hidden=1 AND col_name NOT IN (${SYS}) THEN 1 ELSE 0 END) AS varchar)
  + ' | 明细必填总数=' + CAST(SUM(CASE WHEN place LIKE '%detail%' AND required=1 AND col_name NOT IN (${SYS}) THEN 1 ELSE 0 END) AS varchar)
  + ' 其中 hidden=1:' + CAST(SUM(CASE WHEN place LIKE '%detail%' AND required=1 AND hidden=1 AND col_name NOT IN (${SYS}) THEN 1 ELSE 0 END) AS varchar)
  FROM yj_field`))
