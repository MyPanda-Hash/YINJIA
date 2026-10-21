SET NOCOUNT ON;
-- ① 10-18 那批"已审核但没流水"的单据:精确总量
SELECT 方向 = '出·材料出库', 单数 = COUNT(DISTINCT h.单据编号), 行数 = COUNT(*), 数量 = SUM(l.数量)
FROM bd_material_out h JOIN bl_material_out l ON l.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND CONVERT(char(10), h.asp_time1, 120) = '2026-10-18'
  AND ISNULL(l.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM outh f WHERE f.src = 6 AND f.rid = l.id)
UNION ALL
SELECT '入·产成品入库', COUNT(DISTINCT h.单据编号), COUNT(*), SUM(l.实收数量)
FROM bd_finish_in h JOIN bl_finish_in l ON l.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND CONVERT(char(10), h.asp_time1, 120) = '2026-10-18'
  AND ISNULL(l.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM inh f WHERE f.src = 2 AND f.rid = l.id);

-- ② 47 个重复键:流水侧同一 (src,单号,物料,批号) 被写多次
SELECT TOP 15 f.src, f.单据编号, f.物料编码, 批号 = ISNULL(f.批号,'<NULL>'), n = COUNT(*),
       写入者 = MIN(f.asp_user1), 最早 = MIN(f.asp_time1), 最晚 = MAX(f.asp_time1)
FROM inh f GROUP BY f.src, f.单据编号, f.物料编码, ISNULL(f.批号,'<NULL>')
HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

-- ③ 20 行"有流水但 rid 找不到单据行"的物料出库流水
SELECT 单据编号, 行数 = COUNT(*), 物料 = MIN(物料编码), 数量 = SUM(数量), 写入者 = MIN(asp_user1), 写入时间 = MIN(asp_time1)
FROM outh f WHERE f.src = 6 AND NOT EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id = f.rid)
GROUP BY 单据编号 ORDER BY 单据编号;

-- ④ 冲销行
SELECT 方向 = '入', 流水行 = COUNT(*), 已冲销 = SUM(CASE WHEN ISNULL(asp_cancel,'N') = 'Y' THEN 1 ELSE 0 END) FROM inh
UNION ALL
SELECT '出', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N') = 'Y' THEN 1 ELSE 0 END) FROM outh;
