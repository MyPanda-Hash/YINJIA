/* q-13-scols.sql — 成本重算要用到的键列类型/长度(决定临时表索引键大小) */
SET NOCOUNT ON;
GO
SELECT c.column_id, c.name, TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.precision, c.scale
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_movement')
  AND c.name IN (N'src', N'rid', N'仓库键', N'存货编码', N'批号', N'单据日期', N'收入数量', N'发出数量', N'收入金额')
ORDER BY c.column_id;
GO
SELECT c.name, TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.inv_cost_ledger') ORDER BY c.column_id;
GO
SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.inv_cost_ledger');
GO
