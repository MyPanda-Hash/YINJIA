SET NOCOUNT ON;
-- ① 真正的"同一单据行被写多次":按 (src, rid) 聚合
SELECT TOP 15 f.src, f.rid, f.单据编号, 行数 = COUNT(*), 物料数 = COUNT(DISTINCT f.物料编码),
       批号数 = COUNT(DISTINCT ISNULL(f.批号,N'<NULL>')),
       数量合计 = SUM(f.数量), 写入者 = MIN(f.asp_user1)
FROM inh f GROUP BY f.src, f.rid, f.单据编号 HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

-- ② 这些重复行是不是把单据行数量算多了?(流水合计 vs 单据行数量)
SELECT 情形 = CASE WHEN ABS(x.流水合计 - x.单据数量) <= 0.0001 THEN '流水合计 = 单据行数量(未多算)'
                   ELSE '流水合计 <> 单据行数量(多算/少算)' END,
       行数 = COUNT(*), 差额合计 = CAST(SUM(x.流水合计 - x.单据数量) AS decimal(18,4))
FROM (
  SELECT f.src, f.rid, 流水合计 = SUM(f.数量),
         单据数量 = (SELECT MAX(x2.实收数量) FROM bl_purchase_in x2 WHERE f.src = 1 AND x2.id = f.rid)
  FROM inh f WHERE f.src = 1 GROUP BY f.src, f.rid
) x
WHERE x.单据数量 IS NOT NULL
GROUP BY CASE WHEN ABS(x.流水合计 - x.单据数量) <= 0.0001 THEN '流水合计 = 单据行数量(未多算)'
              ELSE '流水合计 <> 单据行数量(多算/少算)' END;

-- ③ 直接看采购入库:同一 rid 多行的那几个,单据行数量是多少
SELECT TOP 10 单号 = f.单据编号, rid = f.rid, 流水行 = COUNT(*), 流水合计 = SUM(f.数量),
       单据数量 = (SELECT MAX(x.实收数量) FROM bl_purchase_in x WHERE x.id = f.rid)
FROM inh f WHERE f.src = 1
GROUP BY f.单据编号, f.rid HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

-- ④ 产成品入库:同一 rid 多行
SELECT TOP 10 单号 = f.单据编号, rid = f.rid, 流水行 = COUNT(*), 流水合计 = SUM(f.数量),
       单据数量 = (SELECT MAX(x.实收数量) FROM bl_finish_in x WHERE x.id = f.rid)
FROM inh f WHERE f.src = 2
GROUP BY f.单据编号, f.rid HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;
