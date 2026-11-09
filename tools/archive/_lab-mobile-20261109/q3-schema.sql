SET NOCOUNT ON;
PRINT '=== head table columns ===';
SELECT t.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('rd_spike_water_head','rd_equip_use_head','rd_instr_use_head')
ORDER BY t.name, c.column_id;
GO
PRINT '=== detail table columns ===';
SELECT t.name AS tbl, c.column_id, c.name AS col, ty.name AS typ
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('rd_spike_water_detail','rd_equip_use_detail','rd_instr_use_detail')
ORDER BY t.name, c.column_id;
GO
PRINT '=== max seq per panel/place ===';
SELECT panel_code, place, MAX(seq) AS maxseq, COUNT(*) AS n FROM yj_field
WHERE panel_code IN ('RD_SPIKE_WATER','RD_EQUIP_USE','RD_INSTR_USE')
GROUP BY panel_code, place ORDER BY panel_code, place;
GO
PRINT '=== dict_sql of std lib fields ===';
SELECT panel_code, col_name, data_type, dict_sql, place, seq FROM yj_field
WHERE panel_code IN ('RD_SPIKE_WATER','RD_EQUIP_USE','RD_INSTR_USE') AND data_type = N'标准库';
GO
PRINT '=== any attachment field existing ===';
SELECT panel_code, col_name, label, data_type, place FROM yj_field WHERE data_type = N'附件';
GO
