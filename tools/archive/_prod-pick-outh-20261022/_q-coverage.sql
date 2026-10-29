SET NOCOUNT ON;
SELECT '=== bl_material_out vs outh coverage ===' AS s;
SELECT COUNT(DISTINCT b.单据编号) AS 材料出库单数_头行,
       COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN b.单据编号 END) AS 已进outh,
       COUNT(DISTINCT CASE WHEN o.id IS NULL THEN b.单据编号 END) AS 未进outh
  FROM dbo.bl_material_out b
  LEFT JOIN dbo.outh o ON o.src = 6 AND o.rid = b.id
 WHERE ISNULL(b.asp_cancel,'N') <> 'Y';
SELECT '=== 未进 outh 的单据(前 15) ===' AS s;
SELECT TOP 15 b.单据编号, b.asp_time1, COUNT(*) AS 行数
  FROM dbo.bl_material_out b
  LEFT JOIN dbo.outh o ON o.src = 6 AND o.rid = b.id
 WHERE ISNULL(b.asp_cancel,'N') <> 'Y' AND o.id IS NULL
 GROUP BY b.单据编号, b.asp_time1 ORDER BY b.asp_time1 DESC;
SELECT '=== outh src=6 重复行检查(同 rid 同物料同批号) ===' AS s;
SELECT COUNT(*) AS 重复组合数 FROM (
  SELECT rid, 物料编码, ISNULL(批号,'') AS 批号 FROM dbo.outh WHERE src = 6
  GROUP BY rid, 物料编码, ISNULL(批号,'') HAVING COUNT(*) > 1) x;
SELECT '=== outh src=6 按单据聚合示例 ===' AS s;
SELECT TOP 5 单据编号, COUNT(*) AS 行数, SUM(数量) AS 合计数量, MIN(单据日期) AS 日期
  FROM dbo.outh WHERE src = 6 GROUP BY 单据编号 ORDER BY MAX(id) DESC;
SELECT '=== bd_material_out 单据数 ===' AS s;
SELECT COUNT(*) AS docs FROM dbo.bd_material_out WHERE ISNULL(asp_cancel,'N') <> 'Y';
