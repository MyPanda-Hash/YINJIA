SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('bs_inv') ORDER BY column_id;
