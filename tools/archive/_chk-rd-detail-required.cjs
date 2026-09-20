/**
 * _chk-rd-detail-required.cjs — 研发管理各面板必填字段全表(place 用 LIKE 复合口径)
 * 用于评估"明细级必填"新校验对研发管理面板(尤其文书面板 RD_SPEC_DOC)的影响面
 * 用法:node tools/archive/_chk-rd-detail-required.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

const SYS = `N'单据编号',N'单据日期',N'创建时间',N'更新时间',N'编辑人',N'编辑日期'`

console.log('=== 研发管理:表头必填(place LIKE header) ===')
console.log(s(`SELECT f.panel_code+' | '+f.label+' | ['+f.place+'] | '+ISNULL(f.data_type,'')
  FROM yj_field f JOIN yj_panel p ON p.panel_code=f.panel_code
  WHERE p.module_group=N'研发管理' AND f.place LIKE '%header%' AND f.required=1 AND f.col_name NOT IN (${SYS})
  ORDER BY f.panel_code, f.seq`))

console.log('')
console.log('=== 研发管理:明细必填(place LIKE detail) ===')
console.log(s(`SELECT f.panel_code+' | '+f.label+' | ['+f.place+'] | '+ISNULL(f.data_type,'')
  FROM yj_field f JOIN yj_panel p ON p.panel_code=f.panel_code
  WHERE p.module_group=N'研发管理' AND f.place LIKE '%detail%' AND f.required=1 AND f.col_name NOT IN (${SYS})
  ORDER BY f.panel_code, f.seq`))
