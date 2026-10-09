SET NOCOUNT ON;
PRINT '=== B) ERP 日志行数 ===';
GO
SELECT COUNT(*) AS ERP日志行数 FROM erp_imp_log;
GO
PRINT '=== C) 各单据表用到的仓库 ===';
GO
SELECT N'采购入库单' AS 单据, 仓库, COUNT(*) AS 行数 FROM bl_purchase_in GROUP BY 仓库
UNION ALL SELECT N'产成品入库单', 仓库, COUNT(*) FROM bl_finish_in GROUP BY 仓库
UNION ALL SELECT N'其他入库单', 仓库, COUNT(*) FROM bl_other_in GROUP BY 仓库
UNION ALL SELECT N'材料出库单', 仓库, COUNT(*) FROM bl_material_out GROUP BY 仓库
UNION ALL SELECT N'销售出库单', 仓库, COUNT(*) FROM bl_sale_out GROUP BY 仓库;
GO
PRINT '=== D) 库存台账视图前 5 行 ===';
GO
SELECT TOP 5 * FROM v_stock_ledger;
GO
PRINT '=== E) 库存状况表视图前 5 行 ===';
GO
SELECT TOP 5 * FROM v_stock_balance;
GO
