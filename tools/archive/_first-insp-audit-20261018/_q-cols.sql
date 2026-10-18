SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'yj_panel') ORDER BY c.column_id;
