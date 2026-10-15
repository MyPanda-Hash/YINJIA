SET NOCOUNT ON;
SELECT panel_code, panel_name FROM dbo.yj_panel WHERE panel_name LIKE N'%混料%' OR panel_name LIKE N'%装箱%' OR panel_code LIKE N'%MIX%' OR panel_code LIKE N'%PACK%' ORDER BY panel_code;
SELECT name FROM sys.objects WHERE name LIKE N'%push%' OR name LIKE N'%erp%' ORDER BY name;
