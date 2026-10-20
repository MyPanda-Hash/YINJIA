SELECT TOP 30 * FROM yj_role_panel WHERE panel_code='QC_TC_IN'
GO
SELECT m.name AS 列名 FROM sys.columns m WHERE m.object_id=OBJECT_ID('dbo.yj_role_panel') ORDER BY m.column_id
