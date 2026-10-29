SET NOCOUNT ON;
SELECT '=== module_group x category ===' AS s;
SELECT module_group, category, COUNT(*) AS n FROM dbo.yj_panel GROUP BY module_group, category ORDER BY module_group, category;
SELECT '=== 库存核算-ish panels ===' AS s;
SELECT panel_code, panel_name, mode, category, module_group, line_table, date_col, page_size
  FROM dbo.yj_panel
 WHERE panel_code IN (N'MATERIAL_OUT', N'MATERIAL_OUT_DETAIL', N'MATERIAL_OUT_STATS', N'STOCK_PICK',
                      N'STOCK_DETAIL', N'STOCK_LEDGER', N'WO_REPORT_LIST', N'WO_MIXING_LIST')
 ORDER BY panel_code;
SELECT '=== src=6 doc prefixes ===' AS s;
SELECT LEFT(单据编号, 4) AS p, COUNT(DISTINCT 单据编号) AS docs, COUNT(*) AS rows_
  FROM dbo.outh WHERE src = 6 GROUP BY LEFT(单据编号, 4) ORDER BY p;
SELECT '=== src=6 单据类型 values ===' AS s;
SELECT 单据类型, COUNT(*) AS n FROM dbo.outh WHERE src = 6 GROUP BY 单据类型;
SELECT '=== src=6 null 批号 / 数量 negative ===' AS s;
SELECT SUM(CASE WHEN 批号 IS NULL OR LTRIM(RTRIM(批号)) = '' THEN 1 ELSE 0 END) AS 无批号,
       SUM(CASE WHEN 数量 < 0 THEN 1 ELSE 0 END) AS 负数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N') = 'Y' THEN 1 ELSE 0 END) AS 已删
  FROM dbo.outh WHERE src = 6;
