SET NOCOUNT ON;
GO
PRINT '=== 服务健康 & 测试账套探针遗留检查 ===';
SELECT 单据编号, 批次号, ISNULL(asp_cancel,N'N') AS asp_cancel,
       (SELECT COUNT(*) FROM sl_recv_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 有效行
FROM sl_recv r WHERE 批次号 LIKE N'HDN-20261003%' OR 单据编号 LIKE N'SL-2026-10-%' ORDER BY id;
GO
SELECT 单据编号, 批次号, ISNULL(asp_cancel,N'N') AS asp_cancel
FROM qc_insp WHERE 批次号 LIKE N'HDN-20261003%' OR 单据编号 LIKE N'IJ-2026-10-%' ORDER BY id;
GO
SELECT 单据编号, 批次号, ISNULL(asp_cancel,N'N') AS asp_cancel
FROM bd_purchase_in WHERE 批次号 LIKE N'HDN-20261003%' OR 单据编号 LIKE N'PI-2026-10-%' ORDER BY id;
GO
