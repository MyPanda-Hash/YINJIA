SET NOCOUNT ON;
SELECT o.name AS 视图, m.definition
  FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE '%inv_cost_ledger%';
