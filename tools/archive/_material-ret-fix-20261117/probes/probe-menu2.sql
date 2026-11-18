SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_menu_node') ORDER BY c.column_id;
SELECT COUNT(*) AS rows_total FROM dbo.yj_menu_node;