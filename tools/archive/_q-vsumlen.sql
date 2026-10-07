SET NOCOUNT ON;
SELECT 'v_stock_summary' AS v, LEN(m.definition) AS n FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID('dbo.v_stock_summary');
GO
