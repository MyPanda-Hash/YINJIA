SET NOCOUNT ON;
SELECT name, type_desc FROM sys.objects WHERE name = 'v_manu_schedule';
SELECT COUNT(*) AS col_n FROM sys.columns WHERE object_id = OBJECT_ID('dbo.v_manu_schedule');
SELECT TOP 60 COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'v_manu_schedule';
