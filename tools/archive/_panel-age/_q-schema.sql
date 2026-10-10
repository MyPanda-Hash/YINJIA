SET NOCOUNT ON;
SELECT 'PANEL_COLS' AS k, c.name AS col, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_panel') ORDER BY c.column_id;
SELECT 'FIELD_COLS' AS k, c.name AS col, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
SELECT 'CONFIG_AT' AS k, ISNULL(CONVERT(varchar(10),config_at,120),'<null>') AS d, COUNT(*) AS n FROM yj_panel GROUP BY CONVERT(varchar(10),config_at,120) ORDER BY 1;
SELECT 'TOTALS' AS k, (SELECT COUNT(*) FROM yj_panel) AS panels, (SELECT COUNT(*) FROM yj_field) AS fields;
GO
