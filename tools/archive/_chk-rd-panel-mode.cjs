/**
 * _chk-rd-panel-mode.cjs — 列出研发管理各面板的 mode/category/detail_key/isDoc 判定依据
 * 目的:解释 RD_FILTER_EFF「保存」为什么没走必填校验(疑似非 doc 路径 → saveArchive)
 * 用法:node tools/archive/_chk-rd-panel-mode.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

console.log('panel_code | mode | category | head_table | line_table | detail_key')
console.log(s(`SELECT panel_code, ISNULL(mode,'(null)'), ISNULL(category,'(null)'), ISNULL(head_table,'(null)'),
    ISNULL(line_table,'(null)'), ISNULL(detail_key,'(null)')
  FROM yj_panel WHERE module_group=N'研发管理' ORDER BY panel_code`))

console.log('')
console.log('=== 头表必填字段数(按 place 分组) ===')
console.log(s(`SELECT panel_code, place, COUNT(*) AS n
  FROM yj_field WHERE panel_code IN (SELECT panel_code FROM yj_panel WHERE module_group=N'研发管理') AND required=1
  GROUP BY panel_code, place ORDER BY panel_code, place`))
