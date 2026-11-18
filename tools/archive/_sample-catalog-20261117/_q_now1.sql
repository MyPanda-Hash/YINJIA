/****** 只读:现行送样登记表面板与目录行 ******/
SET NOCOUNT ON;
SELECT 'PANEL' AS tag, panel_code, panel_name, mode, head_table, line_table, category, module_group, prefix FROM yj_panel WHERE panel_name LIKE N'%送%' OR head_table IN (N'qc_sample_reg', N'qc_insp_commission_head');
SELECT 'COUNT' AS tag, COUNT(*) AS rows_all, SUM(CASE WHEN asp_cancel IS NULL OR asp_cancel=0 THEN 1 ELSE 0 END) AS active_rows FROM qc_sample_reg;
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len, ORDINAL_POSITION AS pos
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_sample_reg' ORDER BY ORDINAL_POSITION;
SELECT 'FIELD' AS tag, label, col_name, seq, data_type, place, visible, hidden, width FROM yj_field WHERE panel_code=N'SAMPLE_REG' ORDER BY seq;
SELECT 'ROW' AS tag, * FROM qc_sample_reg WHERE ISNULL(asp_cancel,0)=0 ORDER BY id;
