SET NOCOUNT ON;
DECLARE @d nvarchar(max) = (SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('v_stock_pick'));
PRINT REPLACE(REPLACE(@d, CHAR(13), ' '), CHAR(10), ' ');
