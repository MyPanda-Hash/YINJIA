SET NOCOUNT ON;
PRINT '=== bd_material_ret columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_material_ret') ORDER BY c.column_id;
PRINT '=== test v_prod_ret_list ===';
SELECT TOP 3 * FROM dbo.v_prod_ret_list;