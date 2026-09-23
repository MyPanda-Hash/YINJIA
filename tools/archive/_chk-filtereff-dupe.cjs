/**
 * _chk-filtereff-dupe.cjs — 查 rd_filter_eff_head 重复头行来源(默认约束/触发器/历史数据)
 * 用法:node tools/archive/_chk-filtereff-dupe.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

const T = 'rd_filter_eff_head'
console.log('=== 全表:重复单据编号统计 ===')
console.log(s(`SELECT ISNULL(CAST(单据编号 AS nvarchar(60)),N'<null>')+' | rows='+CAST(COUNT(*) AS varchar) FROM ${T} GROUP BY 单据编号 ORDER BY 单据编号`))

console.log('')
console.log('=== 表级:行数 / 索引 / 主键 ===')
console.log('总行数 =', s(`SELECT COUNT(*) FROM ${T}`))
console.log(s(`SELECT i.name+' | type='+i.type_desc+' | unique='+CAST(i.is_unique AS varchar)+' | cols='+STUFF((
    SELECT ','+c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
    WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,'') COLLATE Chinese_PRC_CI_AS
  FROM sys.indexes i WHERE i.object_id=OBJECT_ID('${T}')`))

console.log('')
console.log('=== 默认约束 ===')
console.log(s(`SELECT dc.name+' | col='+c.name+' | def='+dc.definition FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  WHERE dc.parent_object_id=OBJECT_ID('${T}')`))

console.log('')
console.log('=== 触发器(本表 + 全库相关) ===')
console.log(s(`SELECT name+' | on='+OBJECT_NAME(parent_id)+' | '+(CASE WHEN is_disabled=1 THEN 'disabled' ELSE 'enabled' END)
  FROM sys.triggers WHERE parent_id=OBJECT_ID('${T}') OR name LIKE '%filter_eff%'`))

console.log('')
console.log('=== 是否有同前缀的其它插入来源(视图 INSTEAD OF 触发器) ===')
console.log(s(`SELECT v.name FROM sys.views v WHERE v.name LIKE '%filter_eff%'`))
