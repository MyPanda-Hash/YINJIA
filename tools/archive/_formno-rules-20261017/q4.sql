SET NOCOUNT ON;
SELECT name, TYPE_NAME(user_type_id) AS t FROM sys.columns WHERE object_id = OBJECT_ID('s_allno') ORDER BY column_id;
