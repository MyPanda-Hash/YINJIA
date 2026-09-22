SET NOCOUNT ON;
SELECT 'inv_cost_ledger' AS k, c.name, t.name AS ty, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('inv_cost_ledger') ORDER BY c.column_id;
GO
