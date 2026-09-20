/**
 * _chk-specdoc-no-col.cjs — RD_SPEC_DOC 头表「编号」列到底存什么
 * 关心点:后端 save() 会把载荷里的 编号 当**单据标识**取走(body.remove("编号")),
 * 于是 labelsToCols 永远取不到这个"编号字段",只能回退查库 ⇒ 若该列本就为空,
 * 必填校验会强留一个前端其实允许为空的状态(前端 cur['编号'] 拿到的是单据号,非空)。
 * 用法:node tools/archive/_chk-specdoc-no-col.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

console.log('=== yj_panel RD_SPEC_DOC 关键列 ===')
console.log(s(`SELECT 'head_table='+ISNULL(head_table,'-')+' group_col='+ISNULL(group_col,'-')+' code_col='+ISNULL(code_col,'-')+' prefix='+ISNULL(prefix,'-') FROM yj_panel WHERE panel_code='RD_SPEC_DOC'`))

console.log('')
console.log('=== rd_spec_doc_head 是否有「编号」列 ===')
console.log(s(`SELECT 'has_编号='+CAST(COUNT(*) AS varchar) FROM sys.columns WHERE object_id=OBJECT_ID('rd_spec_doc_head') AND name=N'编号'`))

console.log('')
console.log('=== 抽样:单据编号 vs 编号 列的值 ===')
console.log(s(`SELECT TOP 8 '单据编号=['+ISNULL(单据编号,N'<null>')+'] 编号=['+ISNULL(编号,N'<null>')+'] 名称=['+ISNULL(名称,N'<null>')+']'
  FROM rd_spec_doc_head ORDER BY id DESC`))

console.log('')
console.log('=== 「编号」列为空的单据占比 ===')
console.log(s(`SELECT '总数='+CAST(COUNT(*) AS varchar)+' 编号为空='+CAST(SUM(CASE WHEN ISNULL(编号,N'')=N'' THEN 1 ELSE 0 END) AS varchar)
  +' 名称空='+CAST(SUM(CASE WHEN ISNULL(名称,N'')=N'' THEN 1 ELSE 0 END) AS varchar) FROM rd_spec_doc_head`))
