SET NOCOUNT ON;
-- 哪些面板有 config
SELECT panel_code, mode, LEN(config) AS 长度
FROM yj_panel
WHERE config IS NOT NULL AND LEN(config) > 2
ORDER BY panel_code;
GO
