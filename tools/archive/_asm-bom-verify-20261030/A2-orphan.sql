SET NOCOUNT ON;
-- 列注明数 48 vs 列数 47:找出不指向现存列的 MS_Description(孤儿属性)或重复
SELECT '孤儿属性' AS what, ep.major_id, ep.minor_id, CAST(ep.value AS nvarchar(300)) AS descr
FROM sys.extended_properties ep
WHERE ep.class = 1 AND ep.major_id = OBJECT_ID('dbo.bs_asm_bom') AND ep.name = 'MS_Description'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = ep.major_id AND c.column_id = ep.minor_id);
GO
SELECT '属性总数(含表级)' AS what, COUNT(*) AS cnt FROM sys.extended_properties
WHERE major_id = OBJECT_ID('dbo.bs_asm_bom') AND name = 'MS_Description';
GO
SELECT '属性按minor_id明细' AS what, ep.minor_id, c.name AS col, CAST(ep.value AS nvarchar(100)) AS descr
FROM sys.extended_properties ep LEFT JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
WHERE ep.major_id = OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description'
ORDER BY ep.minor_id;
GO
