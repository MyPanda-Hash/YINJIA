SET NOCOUNT ON;

SELECT 来源='kucun', 批号字面量 = ISNULL(lot_no,'<NULL>'), 行数 = COUNT(*), 余量 = SUM(yl)
FROM kucun WHERE lot_no IS NULL OR lot_no LIKE N'%(未填%' OR lot_no LIKE N'%(空)%' GROUP BY ISNULL(lot_no,'<NULL>')
UNION ALL
SELECT 'inh', ISNULL(批号,'<NULL>'), COUNT(*), SUM(数量) FROM inh
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型 <> N'月结结转' AND (批号 IS NULL OR 批号 LIKE N'%(未填%') GROUP BY ISNULL(批号,'<NULL>')
UNION ALL
SELECT 'outh', ISNULL(批号,'<NULL>'), COUNT(*), SUM(数量) FROM outh
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND (批号 IS NULL OR 批号 LIKE N'%(未填%') GROUP BY ISNULL(批号,'<NULL>')
ORDER BY 1,2;

;WITH f AS (
    SELECT 物料编码, 仓库编码, 批号, 净额 = SUM(净数量) FROM (
        SELECT 物料编码, 仓库编码, 批号, 净数量 = 数量 FROM inh
         WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据类型 <> N'月结结转'
        UNION ALL
        SELECT 物料编码, 仓库编码, 批号, 净数量 = -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
    ) x GROUP BY 物料编码, 仓库编码, 批号
),
k AS (SELECT wzdm, ckdm, lot_no, yl FROM kucun)
SELECT 口径 = '① 流水有、结存无', 键数 = COUNT(*), 差额 = CAST(NULL AS decimal(18,4)) FROM f
 WHERE NOT EXISTS (SELECT 1 FROM k k WHERE k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,''))
UNION ALL
SELECT '② 结存有、流水无', COUNT(*), SUM(k.yl) FROM k
 WHERE NOT EXISTS (SELECT 1 FROM f WHERE k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,''))
UNION ALL
SELECT '③ 两边都有但 yl<>净额', COUNT(*), SUM(k.yl - f.净额) FROM f JOIN k
  ON k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,'')
 WHERE ABS(k.yl - f.净额) > 0.0001
UNION ALL
SELECT 'Σ kucun.yl', NULL, CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun
UNION ALL
SELECT 'Σ 流水净额(排除月结结转)', NULL, CAST(ISNULL(SUM(净数量),0) AS decimal(18,4)) FROM (
  SELECT 数量 AS 净数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型 <> N'月结结转'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z;

SELECT TOP 20 物料编码 = wzdm, 仓库编码 = ckdm, 批号 = ISNULL(lot_no,'<NULL>'), 余量 = yl,
       累计入库 = rkl, 累计出库 = ckl, 来源 = asp_user1, 最后写入 = asp_time1
FROM kucun WHERE yl < 0 ORDER BY yl;

;WITH agg AS (
  SELECT wzdm, ckdm, 合计 = SUM(yl), 行数 = COUNT(*), 负行数 = SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END)
  FROM kucun GROUP BY wzdm, ckdm
)
SELECT 情形 = CASE WHEN 合计 < 0 THEN 'B 总账为负(真缺货)'
                   WHEN 负行数 > 0 THEN 'A 总账为正但某批次负(批次错配)'
                   ELSE 'C 正常' END,
       组合数 = COUNT(*), 负缺口 = SUM(CASE WHEN 合计<0 THEN 合计 ELSE 0 END)
FROM agg GROUP BY CASE WHEN 合计 < 0 THEN 'B 总账为负(真缺货)'
                   WHEN 负行数 > 0 THEN 'A 总账为正但某批次负(批次错配)'
                   ELSE 'C 正常' END;
