-- q9-align-probe.sql — 定位 migrate-align-docdate-batch-time-20261016.sql §1 报「日期转换失败」的元凶(只读)
SET NOCOUNT ON;

PRINT '== 1. 带 批号/批次号 的表 + 其日期列与类型 ==';
WITH b AS (SELECT DISTINCT t.object_id, t.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
           WHERE c.name IN (N'批号',N'批次号') AND t.is_ms_shipped=0)
SELECT b.name AS 表,
       (SELECT TOP 1 c.name FROM sys.columns c WHERE c.object_id=b.object_id AND c.name=N'单据日期') AS 单据日期,
       (SELECT TOP 1 c.name FROM sys.columns c WHERE c.object_id=b.object_id AND c.name=N'日期') AS 日期,
       (SELECT TOP 1 c.name FROM sys.columns c WHERE c.object_id=b.object_id AND c.name=N'发生日期') AS 发生日期
FROM b ORDER BY b.name;

PRINT '== 2. 上表里「文本型日期列」的值无法转日期(会炸 CONVERT)的行 ==';
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + CASE WHEN @sql = N'' THEN N'' ELSE N' UNION ALL ' END
     + N'SELECT ''' + t.name + N''' AS 表, ''' + c.name + N''' AS 列, COUNT(*) AS 坏行数 FROM '
     + QUOTENAME(t.name) + N' WHERE [' + c.name + N'] IS NOT NULL AND LTRIM(RTRIM([' + c.name + N'])) <> N'''''
     + N' AND TRY_CONVERT(date, [' + c.name + N']) IS NULL'
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.is_ms_shipped = 0 AND c.name IN (N'单据日期', N'日期', N'发生日期')
  AND ty.name IN (N'varchar', N'nvarchar', N'char', N'nchar')
  AND EXISTS (SELECT 1 FROM sys.columns k WHERE k.object_id = t.object_id AND k.name IN (N'批号', N'批次号'))
  AND EXISTS (SELECT 1 FROM sys.columns k WHERE k.object_id = t.object_id AND k.name IN (N'单据日期', N'日期', N'发生日期'));
IF @sql = N'' PRINT N'  (没有文本型日期列)';
ELSE EXEC sp_executesql @sql;

PRINT '== 3. 批号/批次号 LIKE %-8位数字 但日期段与日期列不一致的行(§1 的目标行,按表计数)==';
DECLARE @s2 nvarchar(max) = N'';
SELECT @s2 = @s2 + CASE WHEN @s2 = N'' THEN N'' ELSE N' UNION ALL ' END
     + N'SELECT ''' + t.name + N''' AS 表, ''' + c.name + N''' AS 列, COUNT(*) AS 待修行 FROM '
     + QUOTENAME(t.name) + N' WHERE [' + c.name + N'] LIKE N''%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'''
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.is_ms_shipped = 0 AND c.name IN (N'批号', N'批次号');
EXEC sp_executesql @s2;
