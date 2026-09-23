SET NOCOUNT ON;
-- 面板 config JSON(逐个看)
SELECT panel_code, module_group, category, mode, LEN(config) AS 长度, config
FROM yj_panel
WHERE panel_code IN ('QC_INSP');
GO
SELECT panel_code, LEN(config) AS 长度, config FROM yj_panel WHERE panel_code IN ('QC_RECV');
GO
SELECT panel_code, LEN(config) AS 长度, config FROM yj_panel WHERE panel_code IN ('QC_RETURN');
GO
