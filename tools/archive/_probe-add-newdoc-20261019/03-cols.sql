SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('sl_recv') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('qc_insp') ORDER BY c.column_id;
