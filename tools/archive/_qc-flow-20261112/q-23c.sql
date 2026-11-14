SET NOCOUNT ON;
SELECT c.column_id AS seq, c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.qc_tc_in') ORDER BY c.column_id;
