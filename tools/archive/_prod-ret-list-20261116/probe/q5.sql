SET NOCOUNT ON;
SELECT 'V|' + o.name + '|' + REPLACE(REPLACE(m.definition, CHAR(13), ' '), CHAR(10), ' ')
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
WHERE o.name IN ('v_material_out_detail','v_material_ret_detail','v_material_ret_stats','v_material_out_stats');
