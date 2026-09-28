SET NOCOUNT ON
SELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('v_lot_trace')
