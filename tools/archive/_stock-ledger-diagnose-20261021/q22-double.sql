SET NOCOUNT ON;
-- M-003|CK01 的全部流水与结存
SELECT 'inh' AS 表, 单据编号, 单据类型, src, 单据日期, 批号 = ISNULL(批号,'<NULL>'), 数量, 写入者 = asp_user1, 写入时间 = asp_time1, 冲销 = asp_cancel
FROM inh WHERE 物料编码 = 'M-003' AND 仓库编码 = 'CK01'
UNION ALL
SELECT 'outh', 单据编号, 单据类型, src, 单据日期, ISNULL(批号,'<NULL>'), 数量, asp_user1, asp_time1, asp_cancel
FROM outh WHERE 物料编码 = 'M-003' AND 仓库编码 = 'CK01'
UNION ALL
SELECT 'kucun', '', '', 0, NULL, ISNULL(lot_no,'<NULL>'), yl, asp_user1 + '/' + ISNULL(asp_user2,''), asp_time1, asp_cancel
FROM kucun WHERE wzdm = 'M-003' AND ckdm = 'CK01'
ORDER BY 1, 6;

-- 全库:同一 (物料,仓库,批号) 在 inh 里出现多行的
SELECT TOP 10 物料编码, 仓库编码, 批号 = ISNULL(批号,'<NULL>'), 行数 = COUNT(*), 数量 = SUM(数量),
       单据编号s = MIN(单据编号), 类型s = MIN(单据类型)
FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型 <> N'月结结转'
GROUP BY 物料编码, 仓库编码, 批号 HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

SELECT 期初类行数 = COUNT(*), 数量 = SUM(数量) FROM inh WHERE 单据类型 IN (N'期初结存', N'月结结转');
