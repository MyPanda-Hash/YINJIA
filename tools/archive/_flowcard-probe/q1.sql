SET NOCOUNT ON;
PRINT '--- panels in production plan domain ---';
SELECT panel_code, panel_name, module_group, table_name, is_active
FROM yj_panel
WHERE module_group LIKE N'%生产%' OR panel_code IN (N'PROD_PICK',N'PROD_REPORT',N'WORK_ORDER_LIST',N'SCHEDULE_BOARD')
ORDER BY module_group, panel_code;
PRINT '--- yj_panel columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id;
PRINT '--- PROD_REPORT / PROD_PICK existence ---';
SELECT COUNT(*) AS prod_report FROM yj_panel WHERE panel_code IN (N'PROD_REPORT',N'PROD_PICK');
PRINT '--- yj_field columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
PRINT '--- yj_attachment columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_attachment') ORDER BY c.column_id;
PRINT '--- yj_menu_node columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_menu_node') ORDER BY c.column_id;
