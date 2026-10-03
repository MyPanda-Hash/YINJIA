SET NOCOUNT ON;
PRINT '--- v_stock_balance 仓库分布 ---';
SELECT 仓库编码, 仓库, COUNT(*) AS 行数, SUM(现存量) AS 现存量合计 FROM v_stock_balance GROUP BY 仓库编码, 仓库 ORDER BY 行数 DESC;
PRINT '--- 未填仓库占位 ---';
SELECT COUNT(*) AS 未填仓库行 FROM v_stock_balance WHERE 仓库 = N'(未填仓库)' OR 仓库 IS NULL;
PRINT '--- 某物料分仓明细(YJ-SX-031) ---';
SELECT 仓库编码, 仓库, 存货编码, 存货, 主计量, 现存量, 结存单价, 结存金额 FROM v_stock_balance WHERE 存货编码 = N'YJ-SX-031';
PRINT '--- 该物料 kucun 侧 ---';
SELECT id, wzdm, ckdm, lot_no, rkl, ckl, yl, price FROM kucun WHERE wzdm = N'YJ-SX-031';
