/**
 * _chk-insp-plan-docno.cjs — RD_INSP_PLAN「新增后草稿被 文档编号不允许重复 挡下」取证
 * 用法:node tools/archive/_chk-insp-plan-docno.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

console.log('=== rd_insp_plan_head 现存的 单据编号 / 文档编号 ===')
console.log(s(`SELECT ISNULL(单据编号,N'<null>')+' | 文档编号='+ISNULL(文档编号,N'<null>')+' | 标题='+ISNULL(标题,N'<null>')
  +' | id='+CAST(id AS varchar) FROM rd_insp_plan_head ORDER BY id`))

console.log('')
console.log('=== 文档编号=YJ-RD001 的行数 ===')
console.log(s(`SELECT 'count='+CAST(COUNT(*) AS varchar) FROM rd_insp_plan_head WHERE 文档编号=N'YJ-RD001'`))

console.log('')
console.log('=== yj_field:该面板 文档编号 的定义(有无默认值/唯一) ===')
console.log(s(`SELECT panel_code+' | '+col_name+' | label='+label+' | ['+place+'] | required='+CAST(required AS varchar)
  +' | unique='+ISNULL(CAST(unique_flag AS varchar),'-') FROM yj_field WHERE panel_code='RD_INSP_PLAN'`))

console.log('')
console.log('=== DOC_NO_PANELS 里有没有 RD_INSP_PLAN(后端常量) ===')
console.log(s(`SELECT 'backend 常量,见 ButtonService DOC_NO_PANELS'`))
