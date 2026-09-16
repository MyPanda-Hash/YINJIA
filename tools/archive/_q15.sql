SET NOCOUNT ON;
SELECT t.name + '|' + c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bd_purchase_in','bl_purchase_in','bd_sale_out','bl_sale_out') ORDER BY t.name, c.column_id;
