SET NOCOUNT ON;
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
GO
SELECT COUNT(*) AS kucun_rows FROM kucun;
GO
SELECT TOP 3 * FROM kucun;
GO
