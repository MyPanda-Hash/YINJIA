SET NOCOUNT ON;
SELECT c.name, TYPE_NAME(c.user_type_id) t FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_role_panel') ORDER BY c.column_id;
PRINT '--- rows ---';
SELECT TOP 30 * FROM yj_role_panel WHERE panel_code IN (N'PROD_REPORT',N'PROD_PICK',N'WORK_ORDER_LIST');
PRINT '--- role table ---';
SELECT c.name, TYPE_NAME(c.user_type_id) t FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_role') ORDER BY c.column_id;
SELECT TOP 10 * FROM yj_role;
