SET NOCOUNT ON;
-- TEST 库 QC_INSP 面板与字段
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code='QC_INSP';
GO
SELECT id, place, seq, col_name, label, data_type, hidden, visible FROM yj_field WHERE panel_code='QC_INSP' ORDER BY place, seq, id;
GO
-- 正式库 qc_insp_detail 列(核对 部门/部门名称/业务员 是否在行表)
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail' ORDER BY ORDINAL_POSITION;
GO
