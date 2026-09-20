/**
 * _chk-allno-vs-biz.cjs — 台账 s_allno 与业务表逐前缀对账:为什么"刚用过的号"会被重发
 * 用法:node tools/archive/_chk-allno-vs-biz.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

console.log('=== 台账里 FE/MP/LL 前缀的行 ===')
console.log(s(`SELECT ISNULL(lb,N'<null>')+' | ny='+ISNULL(ny,N'<null>')+' | dh='+ISNULL(dh,N'<null>')+' | cancel='+ISNULL(asp_cancel,N'<null>')
  +' | t1='+ISNULL(CONVERT(varchar,asp_time1,120),'-') FROM s_allno WHERE dh LIKE 'FE%' OR dh LIKE 'MP-%' OR dh LIKE 'LL-%' ORDER BY dh`))

console.log('')
console.log('=== s_allno 行总数 / 是否有触发器 ===')
console.log(s(`SELECT 'rows='+CAST(COUNT(*) AS varchar) FROM s_allno`))
console.log(s(`SELECT ISNULL(name,'(无触发器)') FROM sys.triggers WHERE parent_id=OBJECT_ID('s_allno')`))

console.log('')
console.log('=== 台账最近 10 行(按 asp_time1) ===')
console.log(s(`SELECT TOP 10 ISNULL(dh,N'<null>')+' | lb='+ISNULL(lb,N'-')+' | ny='+ISNULL(ny,N'-')+' | '+ISNULL(CONVERT(varchar,asp_time1,120),'-')
  FROM s_allno ORDER BY ID DESC`))

console.log('')
console.log('=== 业务表 FE-2026-09-* vs 台账 ===')
console.log(s(`SELECT ISNULL(h.单据编号,N'<null>')+' | in_allno='+CAST((SELECT COUNT(*) FROM s_allno a WHERE a.dh=h.单据编号) AS varchar)
  FROM rd_filter_eff_head h WHERE h.单据编号 LIKE 'FE-2026-09-%' ORDER BY h.单据编号`))

console.log('')
console.log('=== 是否存在其它 s_allno 同义表(历史/备份)===')
console.log(s(`SELECT name FROM sys.tables WHERE name LIKE '%allno%' OR name LIKE '%_no'`))

console.log('')
console.log('=== 号池写入是否被 asp_cancel 之类过滤:统计 cancel 分布 ===')
console.log(s(`SELECT ISNULL(asp_cancel,N'<null>')+' | n='+CAST(COUNT(*) AS varchar) FROM s_allno GROUP BY asp_cancel`))
