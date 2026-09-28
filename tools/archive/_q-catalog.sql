SET NOCOUNT ON;
SELECT 'QC_CATALOG 面板' AS t, panel_code, panel_name, mode, head_table, line_table, detail_key FROM yj_panel WHERE panel_code IN ('QC_CATALOG','QC_INSP_REC');
SELECT 'QC_CATALOG 字段' AS t, col_name, label, data_type, dict_sql, place, seq, visible
FROM yj_field WHERE panel_code='QC_CATALOG' ORDER BY place, seq;
SELECT 'spec.test 标准库' AS t, COUNT(*) AS 总数, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS 启用数 FROM yj_std_lib WHERE lib_code=N'spec.test';
SELECT TOP 8 'spec.test 样例' AS t, item_code, seq, LEFT(content, 90) AS content前90, enabled FROM yj_std_lib WHERE lib_code=N'spec.test' ORDER BY seq;
SELECT '所有 lib_code 分布' AS t, lib_code, COUNT(*) AS n FROM yj_std_lib GROUP BY lib_code;
