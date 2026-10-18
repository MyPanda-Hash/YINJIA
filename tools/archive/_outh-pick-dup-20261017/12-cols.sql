SET NOCOUNT ON;
PRINT N'== v_stock_movement 列 ==';
SELECT c.column_id, c.name, t.name AS type, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.v_stock_movement') ORDER BY c.column_id;
PRINT N'== inv_cost_ledger 列 ==';
SELECT c.column_id, c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.inv_cost_ledger') ORDER BY c.column_id;
