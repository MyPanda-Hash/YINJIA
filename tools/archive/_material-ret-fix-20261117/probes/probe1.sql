SET NOCOUNT ON;
PRINT '=== panels ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, module_group, detail_key FROM yj_panel WHERE panel_code IN ('MATERIAL_RET','MATERIAL_ISSUE') OR panel_name LIKE N'%生产领料%' OR panel_name LIKE N'%生产退料%';
PRINT '=== cols of bl_material_ret matching 工单 ===';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_material_ret') AND (name LIKE N'%工单%' OR name LIKE N'%领料%');
PRINT '=== yj_field 工单 rows for MATERIAL_RET ===';
SELECT id, panel_code, label, col_name, place, seq, visible, hidden FROM yj_field WHERE panel_code='MATERIAL_RET' AND (label LIKE N'%工单%' OR col_name LIKE N'%工单%');