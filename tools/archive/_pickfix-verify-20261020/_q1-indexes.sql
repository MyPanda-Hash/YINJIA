SET NOCOUNT ON;
SELECT DB_NAME() AS 数据库;

PRINT '--- 1) outh/inh 上所有唯一索引/主键 ---';
SELECT t.表, i.name AS 索引名, i.is_unique, i.is_primary_key, i.has_filter,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic
                 JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM (SELECT N'outh' AS 表 UNION ALL SELECT N'inh') t
  JOIN sys.indexes i ON i.object_id = OBJECT_ID('dbo.' + t.表)
 WHERE i.is_unique = 1 OR i.is_primary_key = 1
 ORDER BY t.表, i.name;

PRINT '--- 2) inv_cost_ledger 主键 ---';
SELECT k.name AS 约束名, i.type_desc,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic
                 JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM sys.key_constraints k
  JOIN sys.indexes i ON i.object_id = k.parent_object_id AND i.index_id = k.unique_index_id
 WHERE k.parent_object_id = OBJECT_ID('dbo.inv_cost_ledger');

PRINT '--- 3) 两个视图是否 4 键 JOIN ---';
SELECT OBJECT_NAME(m.object_id) AS 视图,
       CASE WHEN m.definition LIKE N'%c.存货编码 = m.存货编码%' THEN N'[PASS 4键]' ELSE N'[FAIL 仍旧2键]' END AS 结论
  FROM sys.sql_modules m
 WHERE m.object_id IN (OBJECT_ID('dbo.v_stock_ledger'), OBJECT_ID('dbo.v_stock_balance'));

PRINT '--- 4) 迁移脚本登记情况 ---';
SELECT TOP 5 script_name AS 脚本名, applied_at AS 执行时间 FROM dbo.yj_schema_log
 WHERE script_name LIKE N'%stock-flow-src-rid-grain%'
 ORDER BY applied_at DESC;

PRINT '--- 5) 流水行数 ---';
SELECT N'outh' AS 表, COUNT(*) AS 行数 FROM dbo.outh
UNION ALL SELECT N'inh', COUNT(*) FROM dbo.inh
UNION ALL SELECT N'inv_cost_ledger', COUNT(*) FROM dbo.inv_cost_ledger;

PRINT '--- 6) 现有数据里 (src,rid,物料编码,批号) 是否已有重复 ---';
SELECT TOP 10 src, rid, 物料编码, 批号, COUNT(*) AS 行数
  FROM dbo.outh WHERE rid IS NOT NULL
 GROUP BY src, rid, 物料编码, 批号 HAVING COUNT(*) > 1
 ORDER BY COUNT(*) DESC;
