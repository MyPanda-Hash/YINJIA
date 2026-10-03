SET NOCOUNT ON;
PRINT '--- 库存相关面板(线表指向) ---';
SELECT panel_code, panel_name, mode, ISNULL(line_table,'') AS line_table, ISNULL(head_table,'') AS head_table FROM yj_panel
 WHERE line_table IN ('v_stock_balance','v_stock_ledger','v_stock_summary','v_stock_movement','kucun','inv_cost_ledger')
    OR head_table IN ('v_stock_balance','v_stock_ledger','v_stock_summary','kucun')
    OR panel_code IN ('STOCK_STATUS','STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','INV_COST') ORDER BY panel_code;
PRINT '--- v_stock_balance 列 ---';
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS typ FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_stock_balance') ORDER BY c.column_id;
PRINT '--- 行数 ---';
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水, (SELECT COUNT(*) FROM v_stock_balance) AS 状况行, (SELECT COUNT(*) FROM v_stock_balance WHERE 现存量 <> 0) AS 非零现存量行, (SELECT COUNT(*) FROM v_stock_ledger) AS 台账行, (SELECT COUNT(*) FROM v_stock_summary) AS 汇总行;
PRINT '--- 样例行(非零) ---';
SELECT TOP 5 仓库编码, 仓库, 存货编码, 存货, 主计量, 现存量, 结存金额 FROM v_stock_balance WHERE 现存量 <> 0 ORDER BY 现存量 DESC;
