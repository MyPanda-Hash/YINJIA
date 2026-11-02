SET NOCOUNT ON;
SELECT 'bl_so_order' AS t, name, TYPE_NAME(system_type_id) AS ty
FROM sys.columns WHERE object_id = OBJECT_ID('bl_so_order') ORDER BY column_id;
SELECT 'bd_so_order' AS t, name FROM sys.columns WHERE object_id = OBJECT_ID('bd_so_order') ORDER BY column_id;
