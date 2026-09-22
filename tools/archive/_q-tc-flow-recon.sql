SET NOCOUNT ON;
-- ① 特采单 QC_TC_IN 的表结构与字段登记
SELECT N'1-qc_tc_in 列' AS 段, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qc_tc_in' ORDER BY ORDINAL_POSITION;

SELECT N'2-QC_TC_IN 字段' AS 段, col_name, label, data_type, place, editable, visible, hidden, seq
FROM yj_field WHERE panel_code = 'QC_TC_IN' ORDER BY place, seq;

SELECT N'3-QC_TC_IN 面板' AS 段, panel_code, panel_name, category, mode, head_table, line_table,
       group_col, pk_col, code_col, prefix, date_col
FROM yj_panel WHERE panel_code = 'QC_TC_IN';

-- ④ 检验明细表现有列(看有没有 可用的 是否/特采 类列)
SELECT N'4-qc_insp_detail 列' AS 段, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qc_insp_detail' ORDER BY ORDINAL_POSITION;

-- ⑤ QC_INSP 明细字段里的 布尔/是否 类示例(看渲染惯例)
SELECT N'5-是否类字段示例' AS 段, panel_code, col_name, label, data_type, dict_sql, place
FROM yj_field WHERE data_type = N'是否' AND panel_code IN ('QC_INSP','PURCHASE_IN','QC_RETURN','QC_TC_IN')
ORDER BY panel_code, place, seq;

-- ⑥ 现有 特采单 数据量
SELECT N'6-数据量' AS 段,
       (SELECT COUNT(*) FROM qc_tc_in) AS 特采单头,
       (SELECT COUNT(*) FROM qc_tc_in_detail) AS 特采单行,
       (SELECT COUNT(*) FROM qc_insp) AS 检验单,
       (SELECT COUNT(*) FROM qc_insp_detail) AS 检验行;
