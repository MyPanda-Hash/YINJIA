SET NOCOUNT ON;
SELECT COUNT(*) total, COUNT(DISTINCT 单据编号) distinct_no FROM qc_insp;
SELECT 单据编号, COUNT(*) n, MIN(单据日期) mn, MAX(单据日期) mx, MIN(id) mi, MAX(id) ma
FROM qc_insp WHERE 单据编号 LIKE 'IJ-2026-10-[0-9][0-9][0-9][0-9]'
GROUP BY 单据编号 HAVING COUNT(*)>1 ORDER BY 单据编号 DESC;
