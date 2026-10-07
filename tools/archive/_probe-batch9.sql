SET NOCOUNT ON;
GO
PRINT '=== 探针刚生成的暂收单状态 ===';
SELECT r.单据编号, r.批次号, r.供应商代码, r.批次键,
       (SELECT COUNT(*) FROM sl_recv_detail d WHERE d.单据编号 = r.单据编号) AS 明细行数,
       (SELECT COUNT(*) FROM sl_recv_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')='Y') AS 已软删行数
FROM sl_recv r WHERE r.批次号 LIKE N'HDN-20261003%' ORDER BY r.id DESC;
GO
PRINT '=== 该暂收单明细明细(含软删) ===';
SELECT TOP 20 d.id, d.单据编号, d.物料编码, d.数量, d.批次号, ISNULL(d.asp_cancel,'N') AS asp_cancel
FROM sl_recv_detail d
WHERE d.单据编号 IN (SELECT 单据编号 FROM sl_recv WHERE 批次号 LIKE N'HDN-20261003%')
ORDER BY d.id DESC;
GO
