SET NOCOUNT ON;
SELECT N'qc_return' AS t, c.column_id AS seq, c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.qc_return') ORDER BY c.column_id;
