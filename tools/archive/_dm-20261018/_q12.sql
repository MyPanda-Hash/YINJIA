SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, line_table, module_group FROM yj_panel WHERE panel_code IN ('FIELDMGR','ERPLG','ERPLG_ROW');
SELECT COUNT(*) 词条数 FROM yj_translation WHERE ref_key IN (N'字段管理',N'ERP导入日志',N'面板编码',N'承载列',N'字段名');
