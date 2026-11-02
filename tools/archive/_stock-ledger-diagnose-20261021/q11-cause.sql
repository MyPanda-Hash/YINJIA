SET NOCOUNT ON;
-- ① 474 个负结存键:有没有同物料同仓的入库?(区分"从未入过"与"批次错配")
;WITH nin AS (
  SELECT 物料编码 = ISNULL(RTRIM(物料编码),N''), 仓库编码 = ISNULL(RTRIM(仓库编码),N''), 入 = SUM(数量)
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N'')
)
SELECT 情形 = CASE WHEN n.入 IS NULL THEN '负结存且该(物料,仓库)从来没入过库'
                   ELSE '负结存但有入库(批次/口径错配)' END,
       键数 = COUNT(*), 缺口 = CAST(SUM(k.yl) AS decimal(18,4))
FROM kucun k LEFT JOIN nin n ON n.物料编码 = k.wzdm AND n.仓库编码 = ISNULL(RTRIM(k.ckdm),N'')
WHERE k.yl < 0
GROUP BY CASE WHEN n.入 IS NULL THEN '负结存且该(物料,仓库)从来没入过库'
              ELSE '负结存但有入库(批次/口径错配)' END;

-- ② 无批号的四种写法,在三张表里的键能不能对上
;WITH inl AS (SELECT 物料编码=ISNULL(RTRIM(物料编码),N''), 仓库编码=ISNULL(RTRIM(仓库编码),N''), 批号=ISNULL(RTRIM(批号),N'') FROM inh
              WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'),
     outl AS (SELECT 物料编码=ISNULL(RTRIM(物料编码),N''), 仓库编码=ISNULL(RTRIM(仓库编码),N''), 批号=ISNULL(RTRIM(批号),N'') FROM outh
              WHERE ISNULL(asp_cancel,'N')<>'Y')
SELECT 情形 = '出库键在入库里找不到(同物料同仓)', 键数 = COUNT(*) FROM (SELECT DISTINCT * FROM outl) o
 WHERE NOT EXISTS (SELECT 1 FROM inl i WHERE i.物料编码=o.物料编码 AND i.仓库编码=o.仓库编码 AND i.批号=o.批号)
UNION ALL
SELECT '  其中出库批号是"(未填批号)"或空的', COUNT(*) FROM (SELECT DISTINCT * FROM outl) o
 WHERE (o.批号 = N'(未填批号)' OR o.批号 = N'') AND NOT EXISTS (SELECT 1 FROM inl i WHERE i.物料编码=o.物料编码 AND i.仓库编码=o.仓库编码 AND i.批号=o.批号)
UNION ALL
SELECT '入库键在出库里找不到', COUNT(*) FROM (SELECT DISTINCT * FROM inl) i
 WHERE NOT EXISTS (SELECT 1 FROM outl o WHERE i.物料编码=o.物料编码 AND i.仓库编码=o.仓库编码 AND i.批号=o.批号);

-- ③ 同一 (物料,仓库) 下,入库与出库各自用的批号集合是否完全不交
;WITH il AS (SELECT 物料编码=ISNULL(RTRIM(物料编码),N''), 仓库编码=ISNULL(RTRIM(仓库编码),N''), 批号=ISNULL(RTRIM(批号),N'') FROM inh
             WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码, 仓库编码, 批号),
     ol AS (SELECT 物料编码=ISNULL(RTRIM(物料编码),N''), 仓库编码=ISNULL(RTRIM(仓库编码),N''), 批号=ISNULL(RTRIM(批号),N'') FROM outh
             WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码, 仓库编码, 批号),
     g AS (SELECT DISTINCT 物料编码, 仓库编码 FROM ol),
     hits AS (
       SELECT o.物料编码, o.仓库编码,
              命中 = MAX(CASE WHEN il.批号 IS NULL THEN 0 ELSE 1 END)
       FROM ol o LEFT JOIN il
         ON il.物料编码 = o.物料编码 AND il.仓库编码 = o.仓库编码 AND il.批号 = o.批号
       WHERE EXISTS (SELECT 1 FROM il x WHERE x.物料编码 = o.物料编码 AND x.仓库编码 = o.仓库编码)
       GROUP BY o.物料编码, o.仓库编码),
     per AS (SELECT 物料编码, 仓库编码, 命中 = MAX(命中) FROM hits GROUP BY 物料编码, 仓库编码)
SELECT 情形 = CASE WHEN 命中 > 0 THEN '有交集(部分批次对得上)' ELSE '入库批号与出库批号完全不相交' END,
       组数 = COUNT(*)
FROM per GROUP BY CASE WHEN 命中 > 0 THEN '有交集(部分批次对得上)' ELSE '入库批号与出库批号完全不相交' END;

-- ④ 三个口径的合计对照(用户看不同面板会看到不同数)
SELECT 口径 = 'kucun 现存量(库存明细/库存状况看它)', 行数 = COUNT(*), 合计 = CAST(SUM(yl) AS decimal(18,4)) FROM kucun
UNION ALL
SELECT '全部流水净额(库存台账/收发存看它)', COUNT(*), CAST(SUM(净额) AS decimal(18,4)) FROM (
  SELECT 数量 AS 净额 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z
UNION ALL
SELECT '月结结转行(9月末标记)', COUNT(*), CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE 单据类型 = N'月结结转';

-- ⑤ 成本表:每个 (仓库键,存货编码) 分区末行(成本口径,注意分区**不含批号**)
;WITH x AS (
  SELECT 结存数量, 结存金额, rn = ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期 DESC, src DESC, rid DESC)
  FROM inv_cost_ledger)
SELECT 分区数 = COUNT(*), 末行结存数量合计 = CAST(SUM(结存数量) AS decimal(18,4)),
       末行结存金额合计 = CAST(SUM(结存金额) AS decimal(18,4)),
       负结存分区数 = SUM(CASE WHEN 结存数量 < 0 THEN 1 ELSE 0 END)
FROM x WHERE rn = 1;
