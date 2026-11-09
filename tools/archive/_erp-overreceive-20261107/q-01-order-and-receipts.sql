SET NOCOUNT ON;
PRINT '=== 1) 采购订单 YJ-20261027-05 头 ===';
SELECT * FROM bd_pu_order WHERE 单据编号 = N'YJ-20261027-05';

PRINT '=== 2) 采购订单 YJ-20261027-05 行 ===';
SELECT * FROM bl_pu_order WHERE 单据编号 = N'YJ-20261027-05' ORDER BY 行号;

PRINT '=== 3) 挂了该订单的 MES 采购入库单(头) ===';
SELECT 单据编号, 单据日期, 供应商编码, 采购订单号, 是否已转ERP, ERP单号, 转ERP时间
FROM bd_purchase_in WHERE 采购订单号 = N'YJ-20261027-05' OR 单据编号 IN (N'PI-2026-11-0018');

PRINT '=== 4) 这些入库单的行 ===';
SELECT h.单据编号, h.是否已转ERP, h.ERP单号, l.*
FROM bd_purchase_in h JOIN bl_purchase_in l ON l.单据编号 = h.单据编号
WHERE h.采购订单号 = N'YJ-20261027-05' OR h.单据编号 = N'PI-2026-11-0018';

PRINT '=== 5) 目标单据 PI-2026-11-0018 头 ===';
SELECT * FROM bd_purchase_in WHERE 单据编号 = N'PI-2026-11-0018';
