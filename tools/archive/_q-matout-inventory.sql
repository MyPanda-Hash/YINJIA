-- 探针:材料出库单生成器输入(单结果集,kind|a|b,供 node 生成器解析)
SET NOCOUNT ON;
SELECT 'C' AS kind, t.name AS a, c.name AS b
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('bd_material_out','bl_material_out')
UNION ALL
SELECT 'F', panel_code, col_name FROM yj_field WHERE panel_code = 'MATERIAL_OUT'
ORDER BY kind, a, b;
GO
