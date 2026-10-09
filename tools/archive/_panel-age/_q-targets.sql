SET NOCOUNT ON;
SELECT 'BY_MODULE' AS k, module_group, COUNT(*) AS n FROM yj_panel GROUP BY module_group ORDER BY 2 DESC;
SELECT 'TARGET_PANELS' AS k, p.panel_code, p.panel_name, p.module_group, p.category, p.mode, ISNULL(p.line_table,'') AS line_table, (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code=p.panel_code) AS fields FROM yj_panel p WHERE p.module_group IN (N'智能供应链',N'品质管理') ORDER BY p.module_group, p.panel_code;
GO
