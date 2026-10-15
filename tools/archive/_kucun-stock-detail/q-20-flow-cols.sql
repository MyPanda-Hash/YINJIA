-- q-20-flow-cols.sql — inh/outh 列清单(月结结转要写哪些列、报表「箱数」有没有现成列)
SET NOCOUNT ON;
SELECT N'inh 列' AS k, c.column_id, c.name, t.name AS 类型, c.max_length, c.is_nullable,
       CAST(ep.value AS nvarchar(200)) AS 注明
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('inh') ORDER BY c.column_id;
GO
SELECT N'outh 列' AS k, c.column_id, c.name, t.name AS 类型, c.max_length, c.is_nullable,
       CAST(ep.value AS nvarchar(200)) AS 注明
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('outh') ORDER BY c.column_id;
GO
SELECT N'inh 索引' AS k, i.name, i.type_desc, i.is_unique, i.has_filter, i.filter_definition
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('inh') AND i.type > 0;
GO
SELECT N'月内单据日期分布' AS k, 单据类型, src, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚, COUNT(*) AS 行数
FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 单据类型, src ORDER BY src;
GO
SELECT N'outh 出库行批号填充率' AS k, 单据类型, COUNT(*) AS 行数,
       SUM(CASE WHEN 批号 IS NULL OR LTRIM(RTRIM(批号)) = '' THEN 1 ELSE 0 END) AS 无批号行,
       MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚
FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 单据类型 ORDER BY 行数 DESC;
GO
