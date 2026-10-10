SET NOCOUNT ON;
PRINT N'-- 1. bs_wh(编码/名称/状态)';
SELECT 仓库编码, 仓库名称, 状态 FROM bs_wh;
PRINT N'-- 2. 已审核采购入库单行的仓库取值(真实口径)';
SELECT TOP 8 单据编号, 存货编码, 实收数量, 仓库, 仓库编码 FROM bl_purchase_in
 WHERE ISNULL(仓库, N'') <> N'' ORDER BY id DESC;
PRINT N'-- 3. bl_purchase_in 行里 仓库/仓库编码 两列非空计数';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(仓库, N'') <> N'' THEN 1 ELSE 0 END) AS 仓库非空,
       SUM(CASE WHEN ISNULL(仓库编码, N'') <> N'' THEN 1 ELSE 0 END) AS 仓库编码非空
  FROM bl_purchase_in;
PRINT N'-- 4. 采购订单明细 仓库 取值样例';
SELECT TOP 8 单据编号, 物料编码, 数量, 仓库 FROM bl_pu_order WHERE ISNULL(仓库, N'') <> N'' ORDER BY id DESC;
PRINT N'-- 5. 暂收单明细 仓库 取值样例';
SELECT TOP 8 单据编号, 物料编码, 数量, 仓库 FROM sl_recv_detail WHERE ISNULL(仓库, N'') <> N'' ORDER BY id DESC;
PRINT N'-- 6. 检验单明细 仓库/仓库代码 样例';
SELECT TOP 8 单据编号, 物料编码, 送检数量, 仓库, 仓库代码 FROM qc_insp_detail ORDER BY id DESC;
