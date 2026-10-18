SET NOCOUNT ON;
SELECT TOP 5 单据编号, 单据类型, 单据日期, COUNT(*) OVER() AS 总数 FROM inh WHERE 单据类型=N'月结结转';
PRINT '=== 月度结转行(按单号前5) ===';
SELECT 单据编号, COUNT(*) n, SUM(数量) q FROM inh WHERE 单据类型=N'月结结转' GROUP BY 单据编号;
