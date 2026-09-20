/**
 * _chk-allno.cjs — 单号台账 s_allno 与业务表的对账(定位"新增发到已用编号")
 * 用法:node tools/archive/_chk-allno.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

console.log('=== s_allno 表结构 ===')
console.log(s(`SELECT c.name+' '+t.name+' len='+CAST(c.max_length AS varchar) FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('s_allno') ORDER BY c.column_id`))

console.log('')
console.log('=== s_allno 中 MP 开头的行 ===')
console.log(s(`SELECT ISNULL(lb,N'<null>')+' | ny='+ISNULL(ny,N'<null>')+' | dh='+ISNULL(dh,N'<null>') FROM s_allno WHERE dh LIKE 'MP%' ORDER BY dh`))

console.log('')
console.log('=== yj_panel RD_MOLD_PROC 的 prefix ===')
console.log(s(`SELECT 'prefix=['+ISNULL(prefix,N'<null>')+'] date_col=['+ISNULL(date_col,N'<null>')+']' FROM yj_panel WHERE panel_code='RD_MOLD_PROC'`))

console.log('')
console.log('=== 业务表 MP-2026-09-* 单据编号 ===')
console.log(s(`SELECT ISNULL(单据编号,N'<null>') FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-09-%' ORDER BY 单据编号`))

console.log('')
console.log('=== 台账与业务表差异:业务表有、台账无(会被重新发号)===')
console.log(s(`SELECT ISNULL(h.单据编号,N'<null>')+' | allno='+ISNULL(CONVERT(varchar,(SELECT COUNT(*) FROM s_allno a WHERE a.dh=h.单据编号)),'0')
  FROM rd_mold_proc_head h WHERE h.单据编号 LIKE 'MP-2026-09-%' ORDER BY h.单据编号`))
