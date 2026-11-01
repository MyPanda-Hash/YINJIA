SET NOCOUNT ON;
-- 假设:kucun 是「截至 2026-09-30 的流水净额」(月结 reconcileKucun 的 endEx = 2026-10-01)
;WITH f9 AS (
    SELECT 物料编码 = ISNULL(RTRIM(物料编码),N''), 仓库编码 = ISNULL(RTRIM(仓库编码),N''), 批号 = ISNULL(RTRIM(批号),N''),
           净额 = SUM(q) FROM (
        SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh
         WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期 < '2026-10-01'
        UNION ALL
        SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
         WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-10-01'
    ) t GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')
),
f_all AS (
    SELECT 物料编码 = ISNULL(RTRIM(物料编码),N''), 仓库编码 = ISNULL(RTRIM(仓库编码),N''), 批号 = ISNULL(RTRIM(批号),N''),
           净额 = SUM(q) FROM (
        SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh
         WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
        UNION ALL
        SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
    ) t GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')
),
k AS (SELECT wzdm, ckdm = ISNULL(RTRIM(ckdm),N''), lot = ISNULL(RTRIM(lot_no),N''), yl FROM kucun)
SELECT 口径 = 'kucun vs 流水(截至9/30)', 键数 = COUNT(*), 差额之和 = CAST(SUM(k.yl - f9.净额) AS decimal(18,4))
FROM f9 JOIN k ON k.wzdm=f9.物料编码 AND k.ckdm=f9.仓库编码 AND k.lot=f9.批号 WHERE ABS(k.yl - f9.净额) > 0.0001
UNION ALL
SELECT 'kucun 有·流水(≤9/30)无', COUNT(*), CAST(SUM(k.yl) AS decimal(18,4)) FROM k
 WHERE NOT EXISTS (SELECT 1 FROM f9 WHERE k.wzdm=f9.物料编码 AND k.ckdm=f9.仓库编码 AND k.lot=f9.批号)
UNION ALL
SELECT '流水(≤9/30)有·kucun 无', COUNT(*), CAST(SUM(f9.净额) AS decimal(18,4)) FROM f9
 WHERE NOT EXISTS (SELECT 1 FROM k WHERE k.wzdm=f9.物料编码 AND k.ckdm=f9.仓库编码 AND k.lot=f9.批号)
UNION ALL
SELECT 'Σ kucun.yl', NULL, CAST(SUM(yl) AS decimal(18,4)) FROM kucun
UNION ALL
SELECT 'Σ 流水净额(≤9/30,排除结转)', NULL, CAST(SUM(净额) AS decimal(18,4)) FROM f9
UNION ALL
SELECT 'Σ 流水净额(全部,排除结转)', NULL, CAST(SUM(净额) AS decimal(18,4)) FROM f_all;

-- 10 月的库存单据是否真的过账了
SELECT 方向='入', 单据编号, 单据类型, 单据日期, 行数=COUNT(*), 数量=SUM(数量), 写入者=MIN(asp_user1), 写入时间=MIN(asp_time1)
FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期 >= '2026-10-01'
GROUP BY 单据编号, 单据类型, 单据日期
UNION ALL
SELECT '出', 单据编号, 单据类型, 单据日期, COUNT(*), SUM(数量), MIN(asp_user1), MIN(asp_time1)
FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-10-01'
GROUP BY 单据编号, 单据类型, 单据日期
ORDER BY 1,4;
