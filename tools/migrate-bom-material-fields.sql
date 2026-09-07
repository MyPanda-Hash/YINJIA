-- migrate-bom-material-fields.sql — 物料清单(基础档案 BOM)子件表补产品文件物料字段
SET NOCOUNT ON;
GO
BEGIN TRY
IF COL_LENGTH('bl_bom', '物料种类') IS NULL ALTER TABLE bl_bom ADD [物料种类] nvarchar(50) NULL;
IF COL_LENGTH('bl_bom', '物料规格') IS NULL ALTER TABLE bl_bom ADD [物料规格] nvarchar(200) NULL;
IF COL_LENGTH('bl_bom', '外观要求') IS NULL ALTER TABLE bl_bom ADD [外观要求] nvarchar(500) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_bom 加列跳过';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='BOM' AND col_name=N'物料种类')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
VALUES ('BOM', N'物料种类', N'物料种类', N'下拉框', N'SELECT v FROM (VALUES (N''炭粉''),(N''胶粉''),(N''折算物料''),(N''包装材料''),(N''辅助材料'')) AS t(v)', NULL, NULL, NULL, N'detail', 115, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='BOM' AND col_name=N'物料规格')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
VALUES ('BOM', N'物料规格', N'物料规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 118, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='BOM' AND col_name=N'外观要求')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
VALUES ('BOM', N'外观要求', N'外观要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 200, 1, 0, 0, 1);
GO
PRINT N'物料清单产品文件字段补齐完成';
GO