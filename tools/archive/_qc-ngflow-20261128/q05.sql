SELECT COUNT(*) AS insp_rows, SUM(CASE WHEN ISNULL(特采,0)=1 THEN 1 ELSE 0 END) AS tc_on
FROM qc_insp_detail;
GO
SELECT name, TYPE_NAME(user_type_id) AS t, max_length FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.qc_insp_rec') ORDER BY column_id;
GO
SELECT TOP 5 单据编号, 检验结论, 来料检验单号, 物料编码 FROM qc_insp_rec ORDER BY id DESC;
