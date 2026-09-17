SET NOCOUNT ON;
SELECT 存货, 仓库, COUNT(*) AS n FROM v_stock_ledger WHERE 存货 IN (N'A+级烧结炭棒') OR 仓库 IS NULL GROUP BY 存货, 仓库;
SELECT 单据类型, COUNT(*) AS 无仓库行 FROM v_stock_ledger WHERE 仓库 IS NULL OR RTRIM(ISNULL(仓库,''))='' GROUP BY 单据类型;
