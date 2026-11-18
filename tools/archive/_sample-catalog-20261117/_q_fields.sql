/****** 只读:面板字段/译名/目录行快照 ******/
SET NOCOUNT ON;
SELECT 'F_SAMPLE' AS tag, id, label, col_name, data_type, place, seq, visible, hidden, editable, width, alias
FROM yj_field WHERE panel_code = N'SAMPLE_REG' ORDER BY seq, id;
SELECT 'F_INSP' AS tag, id, label, col_name, place, seq, visible, hidden
FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND place LIKE '%detail%' ORDER BY seq, id;
SELECT 'T' AS tag, scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'内部检出限', N'检测误差', N'收费（一个样/元）', N'标准方法检出限') ORDER BY ref_key, locale;
SELECT 'CONF' AS tag, panel_code, mode, line_table, pk_col, code_col, config FROM yj_panel WHERE panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION');
