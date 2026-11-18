SET NOCOUNT ON;
SELECT 'COUNT' AS tag, COUNT(*) AS active FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y';
SELECT 'TOTAL' AS tag, COUNT(*) AS all_rows, SUM(CASE WHEN asp_cancel = N'Y' THEN 1 ELSE 0 END) AS cancelled FROM dbo.qc_sample_reg;
SELECT 序号, 检测元素, 内部检出限 AS 标准方法检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注
FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y' ORDER BY 序号, id;
SELECT 'FIELD' AS tag, panel_code, label, col_name FROM yj_field
WHERE col_name = N'内部检出限' AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION');
SELECT 'TRANS' AS tag, scope, ref_key, locale, text FROM yj_translation WHERE ref_key = N'标准方法检出限';
