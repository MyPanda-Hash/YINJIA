SET NOCOUNT ON;
PRINT '=== 金蝶调拨单产生的流水 ===';
SELECT 'inh' t, src, 单据编号, 物料编码, ISNULL(批号,'<NULL>') lot, 仓库编码, 数量, asp_cancel FROM inh WHERE 单据编号 LIKE 'YCD%'
UNION ALL
SELECT 'outh', src, 单据编号, 物料编码, ISNULL(批号,'<NULL>'), 仓库编码, -数量, asp_cancel FROM outh WHERE 单据编号 LIKE 'YCD%'
ORDER BY 单据编号, t;
PRINT '=== 合计:调拨进出是否相等 ===';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') AS 调入合计,
       (SELECT SUM(数量) FROM outh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') AS 调出合计;
