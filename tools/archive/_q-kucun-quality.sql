SET NOCOUNT ON;
PRINT '--- kucun 索引/约束 ---';
SELECT i.name AS 索引, i.type_desc AS 类型, i.is_unique AS 唯一, i.is_primary_key AS 主键,
       STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,'') AS 列
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.kucun');
PRINT '--- 三键重复(物料×仓库×批号) ---';
SELECT TOP 10 wzdm, ckdm, ISNULL(lot_no,'<null>') AS lot_no, COUNT(*) AS 行数 FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ckdm, lot_no HAVING COUNT(*) > 1 ORDER BY 行数 DESC;
PRINT '--- 谁写的行(asp_user1 分组) ---';
SELECT ISNULL(asp_user1,N'<null>') AS 写入者, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 余量合计 FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY asp_user1 ORDER BY 行数 DESC;
PRINT '--- 外键 ---';
SELECT COUNT(*) AS 外键数 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.kucun');
