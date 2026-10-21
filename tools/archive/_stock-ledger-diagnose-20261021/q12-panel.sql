SET NOCOUNT ON;
SELECT 面板 = panel_code, 名称 = panel_name, 分类 = category, mode, line_table, head_table,
       配置 = LEFT(CAST(ISNULL(config,'') AS nvarchar(300)), 240)
FROM yj_panel WHERE panel_code LIKE 'STOCK%' OR panel_code LIKE '%STOCK%' ORDER BY panel_code;
