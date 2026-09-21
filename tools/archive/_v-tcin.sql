SET NOCOUNT ON;
SELECT '面板行' AS 项, COUNT(*) AS n FROM yj_panel WHERE panel_code='QC_TC_IN';
SELECT '字段行' AS 项, COUNT(*) AS n FROM yj_field WHERE panel_code='QC_TC_IN';
SELECT '头表列' AS 项, COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('qc_tc_in');
SELECT '明细表列' AS 项, COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('qc_tc_in_detail');
SELECT '表注明' AS 项, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('qc_tc_in') AND minor_id=0 AND name='MS_Description';
SELECT '列注明' AS 项, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('qc_tc_in') AND minor_id>0 AND name='MS_Description';
SELECT '明细表注明' AS 项, COUNT(*) AS n FROM sys.extended_properties WHERE major_id=OBJECT_ID('qc_tc_in_detail') AND minor_id=0 AND name='MS_Description';
GO
SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code='QC_TC_IN';
GO
SELECT col_name, label, data_type, ref_panel, ref_field, dict_sql FROM yj_field
WHERE panel_code='QC_TC_IN' AND col_name IN (N'供应商', N'最终处理结果', N'严重程度');
GO
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE (scope='panel' AND ref_key=N'特采单') OR (scope='field' AND ref_key IN (N'管控使用', N'文档编号'));
GO
