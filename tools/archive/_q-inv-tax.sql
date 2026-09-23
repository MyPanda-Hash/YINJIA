SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('bl_purchase_in','bl_sale_out')
  AND (c.name LIKE N'%税%' OR c.name LIKE N'%单价%' OR c.name LIKE N'%金额%')
ORDER BY t.name, c.column_id;
