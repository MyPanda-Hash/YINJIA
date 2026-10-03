SET NOCOUNT ON;
SELECT 'QC_INSP_REC.检验项 字段完整标记' AS t, col_name, data_type, dict_sql, place, seq,
       editable, required, hidden, visible, alias
FROM yj_field WHERE panel_code = 'QC_INSP_REC' AND col_name = N'检验项';
SELECT '对比:文书式面板用标准库的字段(RD_SPIKE_WATER.测试项目)' AS t, col_name, data_type, dict_sql,
       place, editable, visible FROM yj_field WHERE panel_code = 'RD_SPIKE_WATER' AND data_type = N'标准库';
