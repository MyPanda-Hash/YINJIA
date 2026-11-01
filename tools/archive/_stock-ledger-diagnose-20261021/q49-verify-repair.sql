SET NOCOUNT ON;
-- 修复后核对
SELECT 项目 = 'kucun 行数', 值 = CAST(COUNT(*) AS decimal(18,4)) FROM kucun
UNION ALL SELECT 'Σ 现存量', CAST(SUM(yl) AS decimal(18,4)) FROM kucun
UNION ALL SELECT '负行数', CAST(SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS decimal(18,4)) FROM kucun
UNION ALL SELECT '零行数', CAST(SUM(CASE WHEN yl = 0 THEN 1 ELSE 0 END) AS decimal(18,4)) FROM kucun
UNION ALL SELECT 'v_stock_kucun 行数', CAST(COUNT(*) AS decimal(18,4)) FROM v_stock_kucun
UNION ALL SELECT 'Σ 流水净额(排除结转)', CAST(SUM(净额) AS decimal(18,4)) FROM (
  SELECT 数量 AS 净额 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z;

-- 用户那张单的物料
SELECT 物料 = wzdm, 仓库 = ckdm, 批号 = ISNULL(lot_no,'<NULL>'), 累计入 = rkl, 累计出 = ckl, 余量 = yl,
       二次标记 = asp_user2, 时间 = asp_time2
FROM kucun WHERE wzdm = 'YJ-YCYX-055';

SELECT 库存明细该物料 = COUNT(*) FROM v_stock_kucun WHERE 存货编码 = 'YJ-YCYX-055';
SELECT * FROM v_stock_kucun WHERE 存货编码 = 'YJ-YCYX-055';

-- 还剩下多少"应恢复但仍是 0"的
;WITH f AS (
  SELECT 物料编码 = ISNULL(RTRIM(物料编码),N''), 仓库编码 = ISNULL(RTRIM(仓库编码),N''), 批号 = ISNULL(RTRIM(批号),N''), 净额 = SUM(q)
  FROM (SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
        UNION ALL SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') t
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''))
SELECT [应恢复但仍为0] = COUNT(*) FROM kucun k JOIN f ON f.物料编码=k.wzdm AND f.仓库编码=k.ckdm AND f.批号=ISNULL(RTRIM(k.lot_no),N'')
WHERE k.yl = 0 AND ABS(f.净额) > 0.0001;
