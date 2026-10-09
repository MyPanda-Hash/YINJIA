SET NOCOUNT ON;
PRINT N'══ 库存流水 inh:本轮已审核采购入库单的记账行(按单据编号)══';
SELECT src AS 来源面板, 单据编号, rid AS 来源行id, 物料编码, 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, RTRIM(asp_cancel) AS 已冲销
  FROM inh WHERE 单据编号 IN (N'PI-2026-10-0083', N'PI-2026-10-0084', N'PI-2026-10-0086')
 ORDER BY 单据编号;

PRINT N'══ 结存 kucun:CL004 / A-32-01 在 华北工控仓(CK00006) ══';
SELECT wzdm AS 物料, ckdm AS 仓库, lot_no AS 批号, rkl AS 累计入库, yl AS 累计用量, ckl AS 累计出库, update_date AS 更新于
  FROM kucun WHERE ckdm = N'CK00006' AND wzdm IN (N'CL004', N'A-32-01') ORDER BY wzdm, lot_no;

PRINT N'══ 数量核对:流水合计 vs 单据合计 ══';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号 IN (N'PI-2026-10-0083', N'PI-2026-10-0084', N'PI-2026-10-0086')) AS 流水合计,
       (SELECT SUM(实收数量) FROM bl_purchase_in WHERE 单据编号 IN (N'PI-2026-10-0083', N'PI-2026-10-0084', N'PI-2026-10-0086')) AS 单据合计;
