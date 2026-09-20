SET NOCOUNT ON;
PRINT '── qc_return / qc_return_detail 列 ──';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('qc_return','qc_return_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT '── QC_RETURN 面板字段 ──';
SELECT place, seq, col_name, label, data_type, hidden, visible FROM yj_field WHERE panel_code='QC_RETURN' ORDER BY place, seq, col_name;
GO
PRINT '── 现有退回单数据量 ──';
SELECT (SELECT COUNT(*) FROM qc_return) AS 头, (SELECT COUNT(*) FROM qc_return_detail) AS 行;
GO
