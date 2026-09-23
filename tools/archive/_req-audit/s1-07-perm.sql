SET NOCOUNT ON;
GO
SELECT N'S1-24: yj_role_panel 列' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='yj_role_panel' ORDER BY ORDINAL_POSITION;
GO
SELECT N'S1-25: yj_role_panel 全量(前50)' AS sec, * FROM yj_role_panel ORDER BY panel_code;
GO
SELECT N'S1-26: yj_role_panel 面板码去重' AS sec, panel_code, COUNT(*) AS n FROM yj_role_panel GROUP BY panel_code ORDER BY panel_code;
GO
SELECT N'S1-27: 角色表' AS sec, * FROM yj_role;
GO
SELECT N'S1-28: yj_panel 中 mode/category 取值分布' AS sec, mode, category, COUNT(*) AS n FROM yj_panel GROUP BY mode, category ORDER BY mode, category;
GO
SELECT N'S1-29: yj_panel 中带有 config 的面板(全部)' AS sec, panel_code, panel_name, LEN(ISNULL(config,'')) AS L, CONVERT(NVARCHAR(1500), config) AS cfg
FROM yj_panel WHERE config IS NOT NULL AND LEN(config)>2 ORDER BY panel_code;
GO
