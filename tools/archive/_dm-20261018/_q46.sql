SET NOCOUNT ON;
SELECT panel_code, ISNULL(module_group,'(NULL)') AS module_group, mode FROM yj_panel WHERE panel_code IN ('PURCHASE_IN','PURCHASE_IN_DETAIL','PURCHASE_IN_STATS','FINISH_IN','STOCK_BALANCE','STOCK_DETAIL','STOCK_LEDGER','STOCK_SUMMARY','ERPLG','FIELDMGR','ZDGL') ORDER BY panel_code;
PRINT '--- module_group 分布 ---';
SELECT LEFT(ISNULL(module_group,N'(NULL)'),20) AS 分组, COUNT(*) n FROM yj_panel GROUP BY module_group ORDER BY n DESC;
