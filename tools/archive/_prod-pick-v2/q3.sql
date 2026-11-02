SELECT name, type_desc FROM sys.objects WHERE name LIKE 'rd\_%' ESCAPE '\' OR name LIKE '%工艺%' ORDER BY name;
GO
-- 全部含 detail/head 且与 rd_ 无关的候选
SELECT t.name, c.cnt FROM sys.tables t CROSS APPLY (SELECT COUNT(*) cnt FROM sys.columns WHERE object_id=t.object_id) c
 WHERE t.name LIKE 'rd\_%' ESCAPE '\' ORDER BY t.name;
GO
SELECT name FROM sys.objects WHERE type IN ('V','FN','IF','TF') AND (name LIKE '%bom%' OR name LIKE '%proc%') ORDER BY name;
GO
-- rd_ 前缀表各自行数(前 40)
DECLARE @s nvarchar(max) = N'';
SELECT @s = @s + CASE WHEN @s='' THEN '' ELSE ' UNION ALL ' END
  + N'SELECT ''' + t.name + N''' t, COUNT_BIG(*) n FROM [' + t.name + N']'
  FROM sys.tables t WHERE t.name LIKE 'rd\_%' ESCAPE '\';
EXEC sp_executesql @s;
