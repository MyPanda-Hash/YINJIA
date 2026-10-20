SET NOCOUNT ON;
SELECT id, 单据类型, 单据编号, 单据日期, 存货编码, 批号, 收入数量, 发出数量, 业务类型, 仓库编码
  FROM dbo.v_stock_ledger WHERE 单据日期 = '2026-10-19';
GO
SELECT id, 单据类型, 单据编号, 单据日期, 存货编码, 批号, 收入数量, 发出数量
  FROM dbo.v_stock_ledger WHERE 单据日期 >= '2026-10-16' ORDER BY 单据日期 DESC;
