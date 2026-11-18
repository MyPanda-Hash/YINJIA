SET NOCOUNT ON;
SELECT LEFT(DB_NAME(),20) AS 库, 结果列数, COUNT(*) AS 单数 FROM dbo.qc_insp_rec GROUP BY 结果列数 ORDER BY 结果列数;
