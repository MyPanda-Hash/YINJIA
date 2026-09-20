SET NOCOUNT ON;
PRINT '── 探针单 PI-2026-09-0009 的行:源单行号是否真写进去了(判定 bug 归属) ──';
SELECT 单据编号, 行号, 存货编码, 实收数量, 源单行号, 计量单位, 单价 FROM bl_purchase_in WHERE 单据编号='PI-2026-09-0009';
GO
SELECT 单据编号, 采购订单号, 是否已转ERP, ERP单号, 单据状态 FROM bd_purchase_in WHERE 单据编号='PI-2026-09-0009';
GO
