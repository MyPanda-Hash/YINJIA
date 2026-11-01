SET NOCOUNT ON;
-- 被清零的 434 个键:按流水重算后应该恢复多少(即"这次 bug 的修复面")
;WITH f AS (
  SELECT 物料编码 = ISNULL(RTRIM(物料编码),N''), 仓库编码 = ISNULL(RTRIM(仓库编码),N''), 批号 = ISNULL(RTRIM(批号),N''),
         净额 = SUM(q), 入 = SUM(CASE WHEN q > 0 THEN q ELSE 0 END)
  FROM (
    SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
    UNION ALL SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y') t
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''))
SELECT 情形 = CASE WHEN f.净额 IS NULL THEN '流水里也没有(真零行)'
                   WHEN ABS(f.净额) > 0.0001 THEN '按流水应恢复为非零'
                   ELSE '按流水仍是 0' END,
       键数 = COUNT(*), 应恢复数量合计 = CAST(SUM(CASE WHEN ABS(ISNULL(f.净额,0)) > 0.0001 THEN f.净额 ELSE 0 END) AS decimal(18,4))
FROM kucun k LEFT JOIN f ON f.物料编码 = k.wzdm AND f.仓库编码 = k.ckdm AND f.批号 = ISNULL(RTRIM(k.lot_no),N'')
WHERE k.yl = 0
GROUP BY CASE WHEN f.净额 IS NULL THEN '流水里也没有(真零行)'
              WHEN ABS(f.净额) > 0.0001 THEN '按流水应恢复为非零'
              ELSE '按流水仍是 0' END;

-- 零行里写者分布(确认都是月结/孤儿清理造的)
SELECT 来源 = ISNULL(asp_user1,'<NULL>'), 二次 = ISNULL(asp_user2,'<NULL>'), 键数 = COUNT(*)
FROM kucun WHERE yl = 0 GROUP BY ISNULL(asp_user1,'<NULL>'), ISNULL(asp_user2,'<NULL>') ORDER BY 键数 DESC;
