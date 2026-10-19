SET NOCOUNT ON;
SELECT c.name AS 列 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
