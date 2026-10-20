SET NOCOUNT ON;
SELECT 单据编号, COUNT(*) AS n FROM sl_recv GROUP BY 单据编号 HAVING COUNT(*) > 1 ORDER BY 单据编号 DESC;
SELECT COUNT(*) AS total, MIN(单据编号) AS mn, MAX(单据编号) AS mx FROM sl_recv;
SELECT TOP 5 单据编号, 单据日期, 单据状态, 供应商 FROM sl_recv WHERE 单据日期 >= '2026-10-19' ORDER BY 单据编号 DESC;
