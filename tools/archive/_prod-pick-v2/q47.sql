SET NOCOUNT ON;
-- 领料出库流水(应有 -3 / -8 两条)
SELECT 单据编号, 物料编码, 数量, asp_time1 FROM outh WHERE 单据编号='LL-2026-10-0006' ORDER BY id;
GO
-- 退货入库流水
SELECT 单据编号, 物料编码, 数量, asp_time1 FROM inh WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007') ORDER BY id;
GO
-- 库存成本台账(是否也重算过)
SELECT TOP 4 物料编码, 仓库编码, 收入数量, 发出数量, 结存数量 FROM inv_cost_ledger WHERE 物料编码 IN ('YJ-ZZ-001','YJ-KBL-012') ORDER BY id DESC;
