SET NOCOUNT ON;
PRINT '=== yj_field MATERIAL_RET ===';
SELECT id, label, col_name, place, seq, visible, hidden, data_type FROM yj_field WHERE panel_code='MATERIAL_RET' ORDER BY seq, id;
PRINT '=== bl_material_ret columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_ret') ORDER BY c.column_id;
PRINT '=== bd_material_ret 工单/领料 cols ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_material_ret') AND (c.name LIKE N'%工单%' OR c.name LIKE N'%领料%');