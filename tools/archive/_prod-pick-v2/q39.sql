SET NOCOUNT ON;
SELECT c.name AS col, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('inh') ORDER BY c.column_id;
