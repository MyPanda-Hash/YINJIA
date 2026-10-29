SET NOCOUNT ON;
SELECT '=== outh by src ===' AS s;
SELECT src, COUNT(*) AS rows, MIN(单据日期) AS min_d, MAX(单据日期) AS max_d, COUNT(DISTINCT 单据编号) AS docs
  FROM dbo.outh GROUP BY src ORDER BY src;
SELECT '=== sample src=6 ===' AS s;
SELECT TOP 8 id, src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
       仓库编码, 仓库名称, 批号, 数量, 成本单价, 成本金额, 往来单位, 经手人, asp_user1, asp_time1
  FROM dbo.outh WHERE src = 6 ORDER BY id DESC;
SELECT '=== sample src=8 ===' AS s;
SELECT TOP 5 id, src, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 仓库名称, 批号, 数量, 经手人, asp_user1, asp_time1
  FROM dbo.outh WHERE src = 8 ORDER BY id DESC;
SELECT '=== panels touching outh / material out ===' AS s;
SELECT panel_code, panel_name, mode, category, line_table, head_table, module_group, date_col, page_size
  FROM dbo.yj_panel
 WHERE line_table LIKE '%outh%' OR head_table LIKE '%outh%' OR panel_code LIKE '%MATERIAL%'
    OR panel_code LIKE '%PICK%' OR panel_code LIKE '%OUT%'
 ORDER BY panel_code;
