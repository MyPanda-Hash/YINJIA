-- _q-change4.sql —— yj_panel 列与 RD_CHANGE 面板行
SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('yj_panel') ORDER BY column_id;
GO
SELECT * FROM yj_panel WHERE panel_code = 'RD_CHANGE';
GO
SELECT * FROM yj_role_panel WHERE panel_code = 'RD_CHANGE';
GO
