SET NOCOUNT ON;
PRINT '── 被移动的那一行现状(PI-2026-09-0009)──';
SELECT id, 单据编号, 行号, 存货名称, 存货编码, 规格型号, 实收数量, 计量单位, 单价, 仓库, 仓库编码, 批号, 源单编号, 源单行号, asp_user1, asp_time1 FROM bl_purchase_in WHERE 单据编号 IN ('PI-2026-09-0009','PI-2026-09-0010');
GO
PRINT '── 沙箱回读依据:已推单 CGRK-20260917-00033 在 MES 侧的历史(ERP单号=该单)──';
SELECT 单据编号, 单据日期, 供应商, 供应商编码, 采购订单号, ERP单号, 是否已转ERP FROM bd_purchase_in WHERE ERP单号='CGRK-20260917-00033';
GO
PRINT '── 同批其它测试单的行(看 TCGRK-PO-001 应有的行形态参照)──';
SELECT 单据编号, 行号, 存货编码, 实收数量, 计量单位, 单价, 仓库编码, 源单编号, 源单行号 FROM bl_purchase_in WHERE 单据编号 IN ('TCGRK-0050','PI-2026-09-0006') ORDER BY 单据编号, id;
GO
