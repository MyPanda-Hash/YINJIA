SET NOCOUNT ON;
-- ① 抽一张"缺流水"的物料出库单看全貌
SELECT 缺流水单 = 'CL-2026-10-0124',
       行表行数 = (SELECT COUNT(*) FROM bl_material_out WHERE 单据编号 = 'CL-2026-10-0124'),
       单头行数 = (SELECT COUNT(*) FROM bd_material_out WHERE 单据编号 = 'CL-2026-10-0124'),
       流水行数 = (SELECT COUNT(*) FROM outh WHERE 单据编号 = 'CL-2026-10-0124'),
       流水最小rid = (SELECT MIN(rid) FROM outh WHERE 单据编号 = 'CL-2026-10-0124'),
       行表最小id = (SELECT MIN(id) FROM bl_material_out WHERE 单据编号 = 'CL-2026-10-0124');

SELECT 表 = 'bl_material_out', 行数 = COUNT(*) FROM bl_material_out
UNION ALL SELECT 'bl_material_out 去重单号', COUNT(DISTINCT 单据编号) FROM bl_material_out
UNION ALL SELECT 'bd_material_out', COUNT(*) FROM bd_material_out
UNION ALL SELECT 'bd_material_out 去重单号', COUNT(DISTINCT 单据编号) FROM bd_material_out;

-- ② 同一单号在行表里出现多次(重复导入特征)
SELECT 重复单号数 = COUNT(*), 多出行 = SUM(n - 1) FROM (
  SELECT 单据编号, n = COUNT(*) FROM bl_material_out GROUP BY 单据编号) a WHERE n > 1;

SELECT TOP 5 单据编号, 行数 = COUNT(*), id最小 = MIN(id), id最大 = MAX(id)
FROM bl_material_out GROUP BY 单据编号 HAVING COUNT(*) > 3 ORDER BY COUNT(*) DESC;

-- ③ 有/没流水的行,按 id 区间看是不是两批
;WITH m AS (
  SELECT l.id, 有流水 = CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END
  FROM bl_material_out l LEFT JOIN (SELECT DISTINCT rid FROM outh WHERE src = 6) f ON f.rid = l.id)
SELECT 分组 = CASE WHEN 有流水 = 1 THEN '有流水' ELSE '没流水' END,
       行数 = COUNT(*), id最小 = MIN(id), id最大 = MAX(id)
FROM m GROUP BY 有流水;

-- ④ 产成品入库同口径
;WITH f2 AS (
  SELECT l.id, l.实收数量, 有流水 = CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END
  FROM bl_finish_in l LEFT JOIN (SELECT DISTINCT rid FROM inh WHERE src = 2) f ON f.rid = l.id)
SELECT 分组 = CASE WHEN 有流水 = 1 THEN '有流水' ELSE '没流水' END,
       行数 = COUNT(*), id最小 = MIN(f2.id), id最大 = MAX(f2.id), 数量合计 = SUM(f2.实收数量)
FROM f2 GROUP BY 有流水;
