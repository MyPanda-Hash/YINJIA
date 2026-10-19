SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('s_allno') ORDER BY column_id;
SELECT TOP 40 * FROM s_allno;
