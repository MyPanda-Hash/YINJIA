SET NOCOUNT ON;
PRINT N'=== 1. rd_* / 研发相关真实表清单(含行数) ===';
SELECT t.name AS tbl,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS cols,
       CAST(p.rows AS INT) AS rows_approx
FROM sys.tables t
JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE 'rd[_]%' OR t.name LIKE '%spec%' OR t.name LIKE '%dev_task%' OR t.name LIKE '%plan_term%'
ORDER BY t.name;
GO
PRINT N'=== 2. 变更/公差 相关表检索(yj_/rd_/bs_) ===';
SELECT name FROM sys.tables
WHERE name LIKE '%change%' OR name LIKE '%ecr%' OR name LIKE '%ecn%' OR name LIKE '%tolerance%'
   OR name LIKE '%tol%' OR name LIKE '%revis%' OR name LIKE '%history%' OR name LIKE '%log%'
ORDER BY name;
GO
PRINT N'=== 3. yj_ 前缀全部表 ===';
SELECT name FROM sys.tables WHERE name LIKE 'yj[_]%' ORDER BY name;
GO
PRINT N'=== 4. 控制表: 审批/状态/修改记录 ===';
SELECT name FROM sys.tables WHERE name LIKE '%approval%' OR name LIKE '%doc_status%' OR name LIKE '%modify%' ORDER BY name;
