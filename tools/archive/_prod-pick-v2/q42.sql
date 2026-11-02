SET NOCOUNT ON;
SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('v_stock_pick');
