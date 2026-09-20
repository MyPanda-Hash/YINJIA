/**
 * _chk-sk0002-forensics.cjs — 查 SK-2026-09-0002 是什么(被探针误删,判断是真实单据还是探针残留)
 * yj_usage_log 记了面板动作与单据号,可据此还原是谁/什么时候建的。
 * 用法:node tools/archive/_chk-sk0002-forensics.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

console.log('=== yj_usage_log 里 SK-2026-09-* 的痕迹 ===')
console.log(s(`SELECT TOP 20 ISNULL(面板名,'-')+' | '+ISNULL(动作,'-')+' | '+ISNULL(单据号,'-')+' | '+ISNULL(账号,'-')
  +' | '+ISNULL(CONVERT(varchar,时间,120),'-') FROM yj_usage_log WHERE 单据号 LIKE 'SK-2026-09-%' ORDER BY 时间 DESC`))

console.log('')
console.log('=== 现存的 rd_soak_head 单据(不删任何东西,只读)===')
console.log(s(`SELECT ISNULL(单据编号,N'<null>')+' | 文档编号='+ISNULL(文档编号,N'<null>')+' | id='+CAST(id AS varchar)
  FROM rd_soak_head ORDER BY id`))

console.log('')
console.log('=== yj_doc_status 里 SK 单据 ===')
console.log(s(`SELECT doc_no+' | saved='+ISNULL(saved,'-')+' | archived='+ISNULL(archived,'-')+' | at='+ISNULL(CONVERT(varchar,archived_at,120),'-')
  FROM yj_doc_status WHERE panel_code='RD_SOAK' ORDER BY doc_no`))

console.log('')
console.log('=== s_allno 里 SK 前缀(号池留痕:谁消耗过哪个号)===')
console.log(s(`SELECT dh+' | lb='+ISNULL(lb,'-')+' | '+ISNULL(CONVERT(varchar,asp_time1,120),'-')+' | user='+ISNULL(asp_user1,'-')
  FROM s_allno WHERE dh LIKE 'SK-%' ORDER BY dh`))

console.log('')
console.log('=== 是否有可供恢复的备份表(RENAME_/bak)===')
console.log(s(`SELECT name FROM sys.tables WHERE name LIKE '%soak%'`))
