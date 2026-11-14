SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('bd_so_order','bd_pu_order')
ORDER BY t.name, c.column_id;
