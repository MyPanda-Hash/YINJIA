SELECT TOP 60 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_panel') ORDER BY column_id;
GO
SELECT TOP 60 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_field') ORDER BY column_id;
