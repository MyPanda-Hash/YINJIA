SET NOCOUNT ON;
SELECT TOP 3 单据日期, 单据编号, 单据状态, 供应商, 业务员, 物料编码, 物料名称, 数量, 单价, 含税金额 FROM v_pu_order_detail ORDER BY 单据日期 DESC;
PRINT '--- 汇总抽样 ---';
SELECT TOP 3 供应商, 物料编码, 物料名称, 单位, 订单数, 数量, 金额, 平均单价, 最早交货日期 FROM v_pu_order_stats ORDER BY 订单数 DESC;
