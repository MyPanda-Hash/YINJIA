SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('v_manu_schedule') ORDER BY c.column_id;
