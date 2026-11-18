SET NOCOUNT ON;
PRINT '== bl_pu_label rows whose 采购订单行id in 11030..11120 ==';
SELECT id, 单据编号, 采购订单行号, 采购订单行id, 物料编码, 打印数量, 补登, 去向单据, asp_cancel
FROM bl_pu_label WHERE 采购订单行id BETWEEN 11030 AND 11120 ORDER BY id;
GO
PRINT '== bl_pu_label newest 15 ==';
SELECT TOP 15 id, 单据编号, 采购订单行号, 采购订单行id, 物料编码, 打印数量, 补登, asp_time1
FROM bl_pu_label ORDER BY id DESC;
