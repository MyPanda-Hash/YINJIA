SET NOCOUNT ON;
PRINT '=== A) 相关面板的物理表 ===';
GO
SELECT panel_code, panel_name, line_table FROM yj_panel WHERE panel_code IN ('MANU_ORDER','WO_REPORT','WO_REPORT_LIST','OTHER_IN','FINISH_IN');
GO
PRINT '=== B) 生产与库存数据量 ===';
GO
SELECT N'生产工单' AS 项, COUNT(*) AS 行数 FROM bl_manu_order;
GO
SELECT N'库存状况(半成品仓)' AS 项, COUNT(*) AS 行数 FROM v_stock_balance WHERE 仓库 = N'半成品仓';
GO
SELECT N'库存状况(成品仓)' AS 项, COUNT(*) AS 行数 FROM v_stock_balance WHERE 仓库 = N'成品仓';
GO
SELECT N'库存状况(原料仓)' AS 项, COUNT(*) AS 行数 FROM v_stock_balance WHERE 仓库 = N'原料仓';
GO
SELECT N'ERP导入日志' AS 项, COUNT(*) AS 行数 FROM erp_imp_log;
GO
SELECT N'库存台账' AS 项, COUNT(*) AS 行数 FROM v_stock_ledger;
GO
SELECT N'收发存汇总' AS 项, COUNT(*) AS 行数 FROM v_stock_summary;
GO
