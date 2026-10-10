SET NOCOUNT ON;
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name AS col FROM sys.columns c
WHERE c.name LIKE '%panel%' ORDER BY 1,2;
GO
