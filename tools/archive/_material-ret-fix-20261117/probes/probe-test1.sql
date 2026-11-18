SET NOCOUNT ON;
PRINT '=== TEST bl_material_ret 工单/加工 cols ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_material_ret') AND (c.name LIKE N'%工单%' OR c.name LIKE N'%加工%');
PRINT '=== TEST panel MATERIAL_RET ===';
SELECT panel_code, panel_name, mode, line_table, head_table FROM yj_panel WHERE panel_code IN ('MATERIAL_RET','PROD_PICK_LIST','PROD_RET_LIST');