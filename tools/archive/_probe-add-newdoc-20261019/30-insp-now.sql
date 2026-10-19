SET NOCOUNT ON;
SELECT COUNT(*) total, COUNT(DISTINCT 单据编号) distinct_no FROM qc_insp;
SELECT 单据编号, COUNT(*) n, MIN(单据日期) mn, MAX(单据日期) mx, MIN(id) mi, MAX(id) ma
FROM qc_insp GROUP BY 单据编号 HAVING COUNT(*)>1 ORDER BY 单据编号 DESC;
SELECT TOP 12 id, 单据编号, 单据日期, 单据状态, 供应商, 审核人, asp_user1, asp_time1
FROM qc_insp ORDER BY id DESC;
