SET NOCOUNT ON;
SELECT COUNT(*) AS 行数, SUM(CASE WHEN [现存量] < 0 THEN 1 ELSE 0 END) AS 负行数, SUM([现存量]) AS 合计
FROM dbo.v_stock_balance;
