SET NOCOUNT ON;
PRINT '=== 检验相关基础表名 ===';
SELECT t.name AS 表, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS 列数
FROM sys.tables t WHERE t.name LIKE '%qc%' ORDER BY t.name;
GO
PRINT '=== 成型工艺清单 detail 检验要求区块 ===';
SELECT TOP 20 * FROM rd_mold_proc_detail WHERE ISNULL(表区,N'') LIKE N'%检验%';
GO
PRINT '=== 成型工艺清单 detail 表区分布 ===';
SELECT ISNULL(表区,N'(空)') AS 表区, COUNT(*) AS 行数 FROM rd_mold_proc_detail GROUP BY 表区;
GO
