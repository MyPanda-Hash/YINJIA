SET NOCOUNT ON;
SELECT t.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name LIKE 'rd_spike%' AND c.column_id <= 12 ORDER BY t.name, c.column_id;
GO
SELECT name FROM sys.tables WHERE name LIKE 'rd_spike%' OR name LIKE 'rd_equip_use%' OR name LIKE 'rd_instr_use%' ORDER BY name;
GO
