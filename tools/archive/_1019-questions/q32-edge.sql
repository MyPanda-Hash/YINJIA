/* 找「上月(2026-09)有流水、但期末为 0 ⇒ 无结转行」的 (物料,仓库,批号) 样本,验证这些批号的上月原始单据仍然陈列 */
WITH mv AS (
    SELECT ISNULL(RTRIM(物料编码),N'') AS wz, ISNULL(RTRIM(仓库编码),N'') AS ck, ISNULL(RTRIM(批号),N'') AS lot,
           SUM(CASE WHEN 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01' THEN 数量 ELSE 0 END) AS vin
    FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转' GROUP BY 物料编码, 仓库编码, 批号
    UNION ALL
    SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''),
           SUM(CASE WHEN 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01' THEN -数量 ELSE 0 END)
    FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 物料编码, 仓库编码, 批号
), agg AS (
    SELECT wz, ck, lot, SUM(vin) AS net9 FROM mv GROUP BY wz, ck, lot
)
SELECT TOP 5 a.wz AS 物料编码, a.ck AS 仓库编码, a.lot AS 批号, a.net9 AS 九月净额
FROM agg a
WHERE a.net9 <> 0
  AND NOT EXISTS (SELECT 1 FROM inh c WHERE c.单据类型 = N'月结结转' AND ISNULL(c.asp_cancel,'N') <> 'Y'
                    AND ISNULL(RTRIM(c.物料编码),N'') = a.wz AND ISNULL(RTRIM(c.仓库编码),N'') = a.ck
                    AND ISNULL(RTRIM(c.批号),N'') = a.lot)
  AND EXISTS (SELECT 1 FROM inh c WHERE ISNULL(c.asp_cancel,'N') <> 'Y'
                    AND ISNULL(RTRIM(c.物料编码),N'') = a.wz AND ISNULL(RTRIM(c.仓库编码),N'') = a.ck
                    AND ISNULL(RTRIM(c.批号),N'') = a.lot)
ORDER BY ABS(a.net9) DESC
GO
/* 参考:有结转行的批号数量 vs 无结转行的九月流水批号数量 */
SELECT
  (SELECT COUNT(DISTINCT CONCAT(物料编码,'|',仓库编码,'|',ISNULL(批号,''))) FROM inh
     WHERE 单据类型 = N'月结结转' AND ISNULL(asp_cancel,'N') <> 'Y') AS 有结转行批号数,
  (SELECT COUNT(*) FROM (SELECT 物料编码, 仓库编码, 批号 FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
       AND 单据类型 <> N'月结结转' AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
     GROUP BY 物料编码, 仓库编码, 批号) t) AS 九月入库批号数
GO
/* 验证「月结快照 入库/出库」与结转行之和的关系:各批结转数量之和 = 快照结存(应为 0 或差额说明) */
SELECT 期初数量, 入库数量, 出库数量, 结存数量 FROM bl_stock_close WHERE 物料编码 = N'Y-XC-2040' AND 仓库编码 = N'YCL-01' AND 期间 = '2026-09'
