SET NOCOUNT ON;
GO
PRINT '=== 正式账套 HSDZ_MES 的 bd_pu_label 全部行 ===';
SELECT id, 单据编号, 采购订单号, 供应商编码, 批次号, 打印人,
       CONVERT(varchar(19), 打印时间, 120) AS 打印时间, 打印次数,
       ISNULL(asp_cancel,'N') AS asp_cancel, asp_user1, CONVERT(varchar(19), asp_time1, 120) AS 建单时间
FROM bd_pu_label ORDER BY id;
GO
PRINT '=== 对应行 ===';
SELECT l.id, l.单据编号, l.采购订单行号, l.采购订单行id, l.物料编码, l.打印数量, ISNULL(l.asp_cancel,'N') AS asp_cancel
FROM bl_pu_label l ORDER BY l.id;
GO
PRINT '=== 测试账套同口径(应 0) ===';
SELECT COUNT(*) AS 存活 FROM HSDZ_MES_TEST.dbo.bd_pu_label WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
