SET NOCOUNT ON;
PRINT '--- bs_op cols + rows ---';
SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bs_op') ORDER BY c.column_id;
SELECT TOP 20 * FROM bs_op;
PRINT '--- bs_route cols ---';
SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bs_route') ORDER BY c.column_id;
SELECT TOP 10 * FROM bs_route;
PRINT '--- wo_progress sample ---';
SELECT TOP 10 * FROM wo_progress ORDER BY id DESC;
