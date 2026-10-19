SET NOCOUNT ON;

PRINT N'== 单据行「现存量」列统计(行数 / 空 / 负 / 零 / 最小 / 最大) ==';
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'
SELECT ''' + o.name + N''' AS 表, COUNT(*) AS 行数,
       SUM(CASE WHEN 现存量 IS NULL THEN 1 ELSE 0 END) AS 空值,
       SUM(CASE WHEN 现存量 < -0.0001 THEN 1 ELSE 0 END) AS 负值,
       SUM(CASE WHEN ABS(现存量) <= 0.0001 AND 现存量 IS NOT NULL THEN 1 ELSE 0 END) AS 零值,
       CAST(MIN(现存量) AS decimal(18,4)) AS 最小,
       CAST(MAX(现存量) AS decimal(18,4)) AS 最大
FROM dbo.' + o.name + N' UNION ALL'
FROM sys.columns c JOIN sys.objects o ON c.object_id=o.object_id
WHERE o.type='U' AND c.name=N'现存量' AND o.name NOT LIKE N'_bak%';
SET @sql = LEFT(@sql, LEN(@sql)-10) + N' ORDER BY 表;';
EXEC (@sql);

PRINT N'== 文本型数量列(库存数量/基本数量/库存基本数量/辅助数量/默认浮动数量) 有值行数 + 样本 ==';
DECLARE @sql2 nvarchar(max) = N'';
SELECT @sql2 = @sql2 + N'
SELECT ''' + o.name + N''' AS 表, ''' + c.name + N''' AS 列,
       SUM(CASE WHEN NULLIF(LTRIM(RTRIM(' + c.name + N')),N'''') IS NOT NULL THEN 1 ELSE 0 END) AS 有值行数,
       MAX(' + c.name + N') AS 样本最大
FROM dbo.' + o.name + N' UNION ALL'
FROM sys.columns c JOIN sys.objects o ON c.object_id=o.object_id
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE o.type='U' AND t.name IN ('nvarchar','varchar')
  AND c.name IN (N'库存数量',N'基本数量',N'库存基本数量',N'辅助数量',N'默认浮动数量',N'基本库存数量')
  AND o.name NOT LIKE N'_bak%';
SET @sql2 = LEFT(@sql2, LEN(@sql2)-10) + N';';
EXEC (@sql2);
