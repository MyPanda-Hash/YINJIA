SET NOCOUNT ON;
SELECT 'H' AS tag, 单据编号, 单据日期, 单据状态, asp_user1, asp_time1 FROM dbo.qc_insp_commission_head ORDER BY id DESC;
SELECT 'D' AS tag, 单据编号, COUNT(*) AS rows FROM dbo.qc_insp_commission_detail GROUP BY 单据编号;
