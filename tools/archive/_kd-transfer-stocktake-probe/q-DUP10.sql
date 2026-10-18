SET NOCOUNT ON;
PRINT '=== CGRK-20260915-03214 明细 ===';
SELECT id AS 明细id, 存货编码, 数量, 仓库编码 FROM bl_purchase_in WHERE 单据编号=N'CGRK-20260915-03214' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
PRINT '--- 该单 inh ---';
SELECT id, rid, 物料编码, 数量, 仓库编码, ISNULL(asp_cancel,'N') cxl FROM inh WHERE 单据编号=N'CGRK-20260915-03214' ORDER BY id;
PRINT '=== 全库:同 rid 重复的流水组 ===';
SELECT 'inh' t, COUNT(*) 组数 FROM (SELECT 单据编号, rid FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND rid IS NOT NULL GROUP BY 单据编号, rid HAVING COUNT(*)>1) x
UNION ALL
SELECT 'outh', COUNT(*) FROM (SELECT 单据编号, rid FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND rid IS NOT NULL GROUP BY 单据编号, rid HAVING COUNT(*)>1) y;
