-- q-08-kucun-shape.sql — KUCUN 表结构与数据画像(做「库存明细」报表的取数底稿)
SET NOCOUNT ON;
SELECT N'列定义' AS k, c.column_id, c.name, t.name AS 类型, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS 中文注明
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('kucun') ORDER BY c.column_id;
GO
SELECT N'行数/键' AS k,
       COUNT(*) AS 总行数,
       COUNT(DISTINCT wzdm) AS 物料数,
       COUNT(DISTINCT ckdm) AS 仓库数,
       COUNT(DISTINCT lot_no) AS 批号数,
       SUM(CASE WHEN ISNULL(yl,0) <> 0 THEN 1 ELSE 0 END) AS 非零结存行,
       SUM(CASE WHEN wzdm = N'*' THEN 1 ELSE 0 END) AS 合计行
FROM kucun;
GO
SELECT N'索引/键' AS k, i.name AS 索引名, i.type_desc, i.is_unique, i.is_primary_key,
       STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
              WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
              ORDER BY ic2.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('kucun') AND i.type > 0;
GO
SELECT TOP 8 N'样本' AS k, * FROM kucun WHERE ISNULL(yl,0) <> 0 ORDER BY yl DESC;
GO
SELECT 'p' AS k, name, OBJECT_NAME(parent_object_id) AS 宿主, OBJECT_DEFINITION(object_id) AS 定义
FROM sys.objects WHERE type IN ('V','P','FN','TF','IF') AND OBJECT_DEFINITION(object_id) LIKE '%kucun%'
ORDER BY type, name;
GO
