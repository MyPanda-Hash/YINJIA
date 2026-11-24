SET NOCOUNT ON;
SELECT TOP 5 [单据日期],[单据编号],[工单号],[工单行号],[客户名称],[产品编码],[检验项目] FROM dbo.v_qc_asm_insp_detail ORDER BY 单据日期 DESC;
SELECT COUNT(*) AS rows_asm FROM dbo.v_qc_asm_insp_detail;
SELECT 'plang cols:';
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.plang') AND (name LIKE '%工单%' OR name='id') ORDER BY column_id;
