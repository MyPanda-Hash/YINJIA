/**
 * _chk-header-required-mismatch.cjs — 前端可见必填 vs 后端强制必填的口径差(只读)
 *
 * 前端 validateInlineDraft 的两个"跳过"口径必须与后端一致,否则会出现
 * "后端要求一个界面上根本填不了的字段" 这种死锁:
 *   ① PanelxList.vue:2436  headerFields = dataSchema.fields.filter(f => !f.hidden)
 *      ⇒ 后端也必须跳过 hidden=1 的表头字段;
 *   ② PanelxList.vue:4055  if (key === '单据编号' || key === '规格书种类') continue
 *      ⇒ 后端也必须跳过 规格书种类(页签分类,新单可为空)。
 * 用法:node tools/archive/_chk-header-required-mismatch.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

const SYS = `N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期'`

console.log('=== 表头必填里,前端会跳过的两类字段 ===')
console.log(s(`SELECT panel_code+' | '+label+' | hidden='+CAST(hidden AS varchar)+' | visible='+CAST(visible AS varchar)
  + ' | editable='+CAST(editable AS varchar)+' | type='+ISNULL(data_type,'')
  FROM yj_field WHERE place LIKE '%header%' AND required=1 AND col_name NOT IN (${SYS})
    AND (hidden=1 OR label=N'规格书种类')
  ORDER BY panel_code, seq`))

console.log('')
console.log('=== 规格书种类 是否必填 ===')
console.log(s(`SELECT panel_code+' | required='+CAST(required AS varchar)+' | ['+place+'] | editable='+CAST(editable AS varchar)
  FROM yj_field WHERE label=N'规格书种类' ORDER BY panel_code`))

console.log('')
console.log('=== RD_SPEC_DOC 表头必填全量 ===')
console.log(s(`SELECT label+' | hidden='+CAST(hidden AS varchar)+' | visible='+CAST(visible AS varchar)+' | ['+place+']'
  FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND place LIKE '%header%' AND required=1 ORDER BY seq`))
