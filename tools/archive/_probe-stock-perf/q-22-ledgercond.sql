SET NOCOUNT ON;
SELECT TOP 3 N'样本' AS k, RTRIM(仓库) AS wh, RTRIM(存货) AS item,
       CONVERT(nvarchar(10), MIN(单据日期), 120) AS d1, CONVERT(nvarchar(10), MAX(单据日期), 120) AS d2, COUNT(*) AS n
  FROM v_stock_ledger GROUP BY 仓库, 存货 ORDER BY COUNT(*) DESC;
GO
