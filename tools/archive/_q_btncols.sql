SET NOCOUNT ON;
PRINT '== yj_panel 列 ==';
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;
PRINT '== yj_panel_button 列 ==';
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel_button') ORDER BY c.column_id;
GO
