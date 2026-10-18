SET NOCOUNT ON;
PRINT '=== 同单据同 rid 出现多条未作废流水(真重复的标志) ===';
SELECT 'inh' t, COUNT(*) 组数 FROM (SELECT 单据编号, rid FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND rid IS NOT NULL GROUP BY 单据编号, rid HAVING COUNT(*)>1) x
UNION ALL
SELECT 'outh', COUNT(*) FROM (SELECT 单据编号, rid FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND rid IS NOT NULL GROUP BY 单据编号, rid HAVING COUNT(*)>1) y;
PRINT '=== CGRK-20260915-03214 的 inh 明细 ===';
SELECT id, rid, 物料编码, 数量, 仓库编码, ISNULL(asp_cancel,'N') cxl FROM inh WHERE 单据编号=N'CGRK-20260915-03214' ORDER BY id;
