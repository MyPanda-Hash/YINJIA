SET NOCOUNT ON;
-- 全库 flat 面板绑定的视图:缺 id 或 asp_cancel 的(报表口径硬要求)
SELECT p.panel_code, p.panel_name, RTRIM(p.line_table) AS line_table,
       CASE WHEN COL_LENGTH(p.line_table,'id') IS NULL THEN N'缺id ' ELSE N'' END +
       CASE WHEN COL_LENGTH(p.line_table,'asp_cancel') IS NULL THEN N'缺asp_cancel' ELSE N'' END AS 问题
FROM yj_panel p
WHERE p.mode = 'flat' AND OBJECT_ID(p.line_table) IS NOT NULL
  AND (COL_LENGTH(p.line_table,'id') IS NULL OR COL_LENGTH(p.line_table,'asp_cancel') IS NULL)
ORDER BY p.panel_code;
